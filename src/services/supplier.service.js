const prisma = require('../config/prisma');

const supplierImportFields = ['name', 'phone', 'alternatePhone', 'email', 'gstin', 'drugLicenseNo', 'address', 'city', 'state', 'pincode', 'creditLimit', 'creditDays', 'openingBalance', 'status'];
const supplierExportFields = [...supplierImportFields, 'createdAt', 'lastPayment', 'outstanding', 'margin'];

function csvEscape(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

async function getSuppliers(storeId) {
  const suppliers = await prisma.supplier.findMany({
    where: { storeId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });
  const entries = await prisma.ledgerEntry.findMany({ where: { storeId, ledgerType: 'SUPPLIER', supplierId: { not: null } }, select: { supplierId: true, amount: true, entryType: true, entryDate: true }, orderBy: { entryDate: 'desc' } });
  const supplierProducts = await prisma.productSupplier.findMany({ where: { supplier: { storeId, isDeleted: false } }, select: { supplierId: true, purchasePrice: true, productBatch: { select: { sellingPrice: true } } } });
  const margins = new Map();
  supplierProducts.forEach((link) => { const cost = Number(link.purchasePrice || 0); const selling = Number(link.productBatch?.sellingPrice || 0); if (cost > 0 && selling > 0) { const current = margins.get(link.supplierId) || { total: 0, count: 0 }; current.total += ((selling - cost) / cost) * 100; current.count += 1; margins.set(link.supplierId, current); } });
  const summaries = new Map();
  entries.forEach((entry) => { const summary = summaries.get(entry.supplierId) || { balance: 0, lastPayment: null }; summary.balance += Number(entry.amount || 0); if (entry.entryType === 'PURCHASE_PAYMENT' && !summary.lastPayment) summary.lastPayment = entry.entryDate; summaries.set(entry.supplierId, summary); });
  return suppliers.map((supplier) => ({ ...supplier, outstanding: summaries.get(supplier.id)?.balance ?? Number(supplier.openingBalance || 0), lastPayment: summaries.get(supplier.id)?.lastPayment || null, margin: margins.get(supplier.id) ? margins.get(supplier.id).total / margins.get(supplier.id).count : null }));
}

async function exportSuppliers(storeId, columns = supplierImportFields) {
  const suppliers = await getSuppliers(storeId);
  const allowedColumns = columns.filter((column) => supplierExportFields.includes(column));
  const exportColumns = ['name', ...allowedColumns.filter((column) => column !== 'name')];
  const labels = { name: 'Name', phone: 'Phone', email: 'Email', address: 'Address', gstin: 'GSTIN', drugLicenseNo: 'DL', contactPerson: 'Contact Name', state: 'State', createdAt: 'Created At', lastPayment: 'Last Payment', outstanding: 'Outstanding', margin: 'Margin %' };
  const rows = suppliers.map((supplier) => exportColumns.map((column) => supplier[column]));
  return [exportColumns.map((column) => labels[column] || column), ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
}

async function importSuppliers(storeId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Import must contain at least one supplier');
  if (rows.length > 1000) throw new Error('Import is limited to 1000 suppliers per file');
  const existing = await prisma.supplier.findMany({ where: { storeId, isDeleted: false }, select: { phone: true, email: true, gstin: true } });
  const used = { phone: new Set(existing.map((row) => row.phone).filter(Boolean)), email: new Set(existing.map((row) => row.email).filter(Boolean)), gstin: new Set(existing.map((row) => row.gstin).filter(Boolean)) };
  const data = rows.map((row, index) => {
    const name = String(row.name || '').trim();
    if (!name) throw new Error(`Row ${index + 2}: Name is required`);
    const normalized = Object.fromEntries(supplierImportFields.map((field) => [field, row[field] === undefined ? null : String(row[field]).trim() || null]));
    for (const key of ['phone', 'email', 'gstin']) { if (normalized[key] && used[key].has(normalized[key])) throw new Error(`Row ${index + 2}: ${key} already exists`); if (normalized[key]) used[key].add(normalized[key]); }
    return { storeId, name, contactPerson: normalized.contactPerson, phone: normalized.phone, alternatePhone: normalized.alternatePhone, email: normalized.email, gstin: normalized.gstin, drugLicenseNo: normalized.drugLicenseNo, address: normalized.address, city: normalized.city, state: normalized.state, pincode: normalized.pincode, creditLimit: Number(normalized.creditLimit || 0), creditDays: Number(normalized.creditDays || 0), openingBalance: Number(normalized.openingBalance || 0), status: ['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(normalized.status) ? normalized.status : 'ACTIVE' };
  });
  await prisma.$transaction(data.map((supplier) => prisma.supplier.create({ data: supplier })));
  return { imported: data.length };
}

async function getSupplierById(supplierId, storeId) {
  return prisma.supplier.findFirst({
    where: {
      id: supplierId,
      storeId,
      isDeleted: false,
    },
  });
}

async function createSupplier(data, storeId) {
  const {
    name,
    contactPerson,
    phone,
    alternatePhone,
    email,
    gstin,
    drugLicenseNo,
    address,
    city,
    state,
    pincode,
    creditLimit,
    creditDays,
    openingBalance,
  } = data;

  if (!name) {
    const error = new Error('Supplier name is required');
    error.statusCode = 400;
    throw error;
  }

  const existing = await prisma.supplier.findFirst({
    where: {
      storeId,
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email }] : []),
        ...(gstin ? [{ gstin }] : []),
      ],
    },
  });

  if (existing) {
    const error = new Error(
      'Supplier with this phone, email or GSTIN already exists'
    );
    error.statusCode = 409;
    throw error;
  }

  return prisma.supplier.create({
    data: {
      storeId,
      name,
      contactPerson: contactPerson || null,
      phone: phone || null,
      alternatePhone: alternatePhone || null,
      email: email || null,
      gstin: gstin || null,
      drugLicenseNo: drugLicenseNo || null,
      address: address || null,
      city: city || null,
      state: state || null,
      pincode: pincode || null,
      creditLimit: creditLimit ?? 0,
      creditDays: creditDays ?? 0,
      openingBalance: openingBalance ?? 0,
    },
  });
}

async function updateSupplier(supplierId, storeId, data) {
  const existing = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      storeId,
    },
  });

  if (!existing) {
    const error = new Error('Supplier not found');
    error.statusCode = 404;
    throw error;
  }

  const {
    name,
    contactPerson,
    phone,
    alternatePhone,
    email,
    gstin,
    drugLicenseNo,
    address,
    city,
    state,
    pincode,
    creditLimit,
    creditDays,
    openingBalance,
    status,
  } = data;

  return prisma.supplier.update({
    where: {
      id: supplierId,
    },
    data: {
      ...(name !== undefined && { name }),
      ...(contactPerson !== undefined && { contactPerson }),
      ...(phone !== undefined && { phone }),
      ...(alternatePhone !== undefined && { alternatePhone }),
      ...(email !== undefined && { email }),
      ...(gstin !== undefined && { gstin }),
      ...(drugLicenseNo !== undefined && { drugLicenseNo }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(pincode !== undefined && { pincode }),
      ...(creditLimit !== undefined && { creditLimit }),
      ...(creditDays !== undefined && { creditDays }),
      ...(openingBalance !== undefined && { openingBalance }),
      ...(status !== undefined && { status }),
    },
  });
}


async function getSupplierLedger(supplierId, storeId) {
  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      storeId,
    },
    select: {
      id: true,
      name: true,
      openingBalance: true,
    },
  });

  if (!supplier) {
    const error = new Error('Supplier not found');
    error.statusCode = 404;
    throw error;
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      storeId,
      supplierId,
      ledgerType: 'SUPPLIER',
    },
    orderBy: [
      { entryDate: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  let balance = 0;

  const ledger = entries.map((entry) => {
    const amount = Number(entry.amount);

    balance += amount;

    return {
      id: entry.id,
      entryType: entry.entryType,
      amount,
      referenceId: entry.referenceId,
      referenceNumber: entry.referenceNumber,
      description: entry.description,
      entryDate: entry.entryDate,
      debit: amount > 0 ? amount : 0,
      credit: amount < 0 ? Math.abs(amount) : 0,
      balance,
      paymentMethod: null,
    };
  });

  const paymentIds = ledger.filter((entry) => entry.entryType === 'PURCHASE_PAYMENT').map((entry) => entry.referenceId).filter(Boolean);
  if (paymentIds.length) {
    const [payments, purchasePayments] = await Promise.all([
      prisma.payment.findMany({ where: { id: { in: paymentIds }, supplierId, storeId }, select: { id: true, paymentMethod: true } }),
      prisma.purchasePayment.findMany({ where: { id: { in: paymentIds }, purchase: { supplierId, storeId } }, select: { id: true, paymentMethod: true } }),
    ]);
    const paymentMethods = new Map([...payments, ...purchasePayments].map((payment) => [payment.id, payment.paymentMethod]));
    ledger.forEach((entry) => { entry.paymentMethod = paymentMethods.get(entry.referenceId) || null; });
  }

  return {
    supplier: {
      id: supplier.id,
      name: supplier.name,
      openingBalance: Number(supplier.openingBalance),
    },
    entries: ledger,
    summary: {
      totalDebit: ledger.reduce((sum, entry) => sum + entry.debit, 0),
      totalCredit: ledger.reduce((sum, entry) => sum + entry.credit, 0),
      balance,
    },
  };
}

async function addSupplierPayment({ supplierId, storeId, amount, paymentMethod, referenceNumber, notes }) {
  const paymentAmount = Number(amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('Payment amount must be greater than 0');
  if (!paymentMethod) throw new Error('Payment method is required');
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId }, select: { id: true, name: true } });
  if (!supplier) { const error = new Error('Supplier not found'); error.statusCode = 404; throw error; }
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({ data: { storeId, supplierId, amount: paymentAmount, paymentMethod, referenceNumber: referenceNumber || null, notes: notes || null } });
    await tx.ledgerEntry.create({ data: { storeId, supplierId, ledgerType: 'SUPPLIER', entryType: 'PURCHASE_PAYMENT', amount: -paymentAmount, referenceId: payment.id, referenceNumber: referenceNumber || null, description: `Payment made to ${supplier.name}` } });
    return payment;
  });
}

async function deleteSupplier(supplierId, storeId) {
  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, storeId, isDeleted: false },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.supplier.update({
    where: { id: supplierId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });
}

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger,
  addSupplierPayment,
  exportSuppliers,
  importSuppliers,
};
