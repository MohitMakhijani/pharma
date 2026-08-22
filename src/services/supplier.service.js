const prisma = require('../config/prisma');

async function getSuppliers(storeId) {
  return prisma.supplier.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
  });
}

async function getSupplierById(supplierId, storeId) {
  return prisma.supplier.findFirst({
    where: {
      id: supplierId,
      storeId,
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
    };
  });

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

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  getSupplierLedger,
};
