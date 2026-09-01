const prisma = require('../config/prisma');

async function getPurchasesReport(storeId, filters = {}) {
  const { fromDate, toDate, supplierId, paymentStatus, search } = filters;

  const dateFilter = {};
  if (fromDate || toDate) {
    if (fromDate) dateFilter.gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate) dateFilter.lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  const where = {
    storeId,
    status: { in: ['RECEIVED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'] },
    ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
    ...(supplierId && supplierId !== 'ALL' ? { supplierId } : {}),
    ...(paymentStatus && paymentStatus !== 'ALL' ? { paymentStatus } : {}),
  };

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: 'insensitive' } },
      { supplier: { name: { contains: q, mode: 'insensitive' } } },
      { supplier: { phone: { contains: q, mode: 'insensitive' } } },
      { supplier: { gstin: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const purchases = await prisma.purchase.findMany({
    where,
    include: {
      supplier: true,
      payments: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
          batch: true,
          packaging: true,
        },
      },
    },
    orderBy: {
      invoiceDate: 'desc',
    },
  });

  // Aggregations
  let totalGrossPurchases = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalNetPurchases = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let totalItemsCount = 0;

  const supplierBreakdownMap = {};
  const dailyTrendsMap = {};
  const topPurchasedProductsMap = {};

  for (const pur of purchases) {
    const total = Number(pur.totalAmount || 0);
    const paid = Number(pur.paidAmount || 0);
    const due = Number(pur.dueAmount || 0);
    const disc = Number(pur.discountAmount || 0);
    const taxable = Number(pur.taxableAmount || 0);
    const cgst = Number(pur.cgstAmount || 0);
    const sgst = Number(pur.sgstAmount || 0);
    const igst = Number(pur.igstAmount || 0);

    totalGrossPurchases += (total + disc);
    totalDiscount += disc;
    totalTaxable += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    totalNetPurchases += total;
    totalPaid += paid;
    totalDue += due;

    // Daily Trend
    const dateKey = pur.invoiceDate ? new Date(pur.invoiceDate).toISOString().split('T')[0] : 'Unknown';
    if (!dailyTrendsMap[dateKey]) {
      dailyTrendsMap[dateKey] = { date: dateKey, invoices: 0, totalAmount: 0, paidAmount: 0 };
    }
    dailyTrendsMap[dateKey].invoices += 1;
    dailyTrendsMap[dateKey].totalAmount += total;
    dailyTrendsMap[dateKey].paidAmount += paid;

    // Supplier Breakdown
    const supName = pur.supplier?.name || 'Unassigned Supplier';
    const supId = pur.supplierId || supName;
    if (!supplierBreakdownMap[supId]) {
      supplierBreakdownMap[supId] = {
        id: supId,
        supplierName: supName,
        phone: pur.supplier?.phone || '—',
        email: pur.supplier?.email || '—',
        gstin: pur.supplier?.gstin || '—',
        drugLicenseNo: pur.supplier?.drugLicenseNo || '—',
        invoicesCount: 0,
        totalPurchases: 0,
        paidAmount: 0,
        dueAmount: 0,
        invoices: [],
      };
    }
    supplierBreakdownMap[supId].invoicesCount += 1;
    supplierBreakdownMap[supId].totalPurchases += total;
    supplierBreakdownMap[supId].paidAmount += paid;
    supplierBreakdownMap[supId].dueAmount += due;
    supplierBreakdownMap[supId].invoices.push({
      id: pur.id,
      invoiceNumber: pur.invoiceNumber,
      invoiceDate: pur.invoiceDate,
      totalAmount: total,
      paidAmount: paid,
      dueAmount: due,
      paymentStatus: pur.paymentStatus,
      itemCount: pur.items.length,
    });

    // Item-level breakdown
    for (const it of pur.items) {
      const qty = Number(it.quantity || 0);
      const freeQty = Number(it.freeQuantity || 0);
      const itemTotal = Number(it.totalAmount || 0);
      totalItemsCount += qty;

      const prodName = it.product?.name || 'Medicine';
      const prodId = it.productId || prodName;
      if (!topPurchasedProductsMap[prodId]) {
        topPurchasedProductsMap[prodId] = {
          id: prodId,
          name: prodName,
          generic: it.product?.genericName || '—',
          sku: it.product?.sku || '—',
          category: it.product?.category?.name || 'General',
          quantity: 0,
          freeQuantity: 0,
          totalCost: 0,
          batchCount: 0,
          batches: [],
        };
      }
      topPurchasedProductsMap[prodId].quantity += qty;
      topPurchasedProductsMap[prodId].freeQuantity += freeQty;
      topPurchasedProductsMap[prodId].totalCost += itemTotal;
      topPurchasedProductsMap[prodId].batchCount += 1;
      topPurchasedProductsMap[prodId].batches.push({
        batchNumber: it.batch?.batchNumber || '—',
        expiryDate: it.batch?.expiryDate || null,
        quantity: qty,
        unitPrice: Number(it.unitPrice || 0),
        mrp: Number(it.mrp || 0),
        supplierName: supName,
        invoiceNumber: pur.invoiceNumber,
        invoiceDate: pur.invoiceDate,
      });
    }
  }

  return {
    period: { fromDate, toDate },
    summary: {
      totalBills: purchases.length,
      totalGrossPurchases,
      totalDiscount,
      totalTaxable,
      totalGst: totalCgst + totalSgst + totalIgst,
      totalNetPurchases,
      totalPaid,
      totalDue,
      totalItemsCount,
    },
    dailyTrends: Object.values(dailyTrendsMap).sort((a, b) => b.date.localeCompare(a.date)),
    supplierBreakdown: Object.values(supplierBreakdownMap).sort((a, b) => b.totalPurchases - a.totalPurchases),
    topProducts: Object.values(topPurchasedProductsMap).sort((a, b) => b.totalCost - a.totalCost).slice(0, 20),
    invoices: purchases.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoiceNumber,
      invoiceDate: p.invoiceDate,
      supplierName: p.supplier?.name || '—',
      supplierPhone: p.supplier?.phone || '—',
      supplierGstin: p.supplier?.gstin || '—',
      itemCount: p.items.length,
      subtotal: Number(p.subtotal || 0),
      discountAmount: Number(p.discountAmount || 0),
      taxAmount: Number(p.cgstAmount || 0) + Number(p.sgstAmount || 0) + Number(p.igstAmount || 0),
      totalAmount: Number(p.totalAmount || 0),
      paidAmount: Number(p.paidAmount || 0),
      dueAmount: Number(p.dueAmount || 0),
      paymentStatus: p.paymentStatus,
      status: p.status,
      items: p.items.map((it) => ({
        id: it.id,
        name: it.product?.name || 'Medicine',
        genericName: it.product?.genericName || '—',
        batchNumber: it.batch?.batchNumber || '—',
        expiryDate: it.batch?.expiryDate || null,
        quantity: Number(it.quantity || 0),
        freeQuantity: Number(it.freeQuantity || 0),
        unitName: it.packaging?.name || 'Units',
        unitPrice: Number(it.unitPrice || 0),
        mrp: Number(it.mrp || 0),
        discountPercent: Number(it.discountPercent || 0),
        totalAmount: Number(it.totalAmount || 0),
      })),
    })),
  };
}

module.exports = {
  getPurchasesReport,
};
