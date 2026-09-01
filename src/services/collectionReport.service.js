const prisma = require('../config/prisma');

async function getCollectionReport(storeId, filters = {}) {
  const { fromDate, toDate, paymentMethod, search } = filters;

  const dateFilter = {};
  if (fromDate || toDate) {
    if (fromDate) dateFilter.gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate) dateFilter.lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  // 1. Fetch direct Sale Payments (Cash / Card / UPI / NetBanking / Cheque)
  const wherePayments = {
    sale: {
      storeId,
    },
    ...(Object.keys(dateFilter).length > 0 ? { paymentDate: dateFilter } : {}),
  };

  if (paymentMethod && paymentMethod !== 'ALL') {
    wherePayments.paymentMethod = { equals: paymentMethod, mode: 'insensitive' };
  }

  const payments = await prisma.salePayment.findMany({
    where: wherePayments,
    include: {
      sale: {
        include: {
          customer: true,
          doctorRel: true,
          items: {
            include: {
              product: true,
              batch: true,
              packaging: true,
            },
          },
        },
      },
    },
    orderBy: {
      paymentDate: 'desc',
    },
  });

  // 2. Fetch Sales Returns for Cash Out / Refund deductions
  const salesReturns = await prisma.salesReturn.findMany({
    where: {
      storeId,
      status: 'COMPLETED',
      ...(Object.keys(dateFilter).length > 0 ? { returnDate: dateFilter } : {}),
    },
    include: {
      customer: true,
      sale: true,
    },
    orderBy: {
      returnDate: 'desc',
    },
  });

  // Calculate Aggregates
  let totalCash = 0;
  let totalUpi = 0;
  let totalCard = 0;
  let totalNetBanking = 0;
  let totalCheque = 0;
  let totalOther = 0;

  const paymentTransactions = [];

  for (const pay of payments) {
    const amount = Number(pay.amount || 0);
    const method = String(pay.paymentMethod || 'CASH').toUpperCase();

    if (method.includes('CASH')) totalCash += amount;
    else if (method.includes('UPI') || method.includes('GPAY') || method.includes('PHONEPE') || method.includes('PAYTM')) totalUpi += amount;
    else if (method.includes('CARD') || method.includes('CREDIT') || method.includes('DEBIT') || method.includes('POS')) totalCard += amount;
    else if (method.includes('NET') || method.includes('BANK') || method.includes('NEFT') || method.includes('RTGS')) totalNetBanking += amount;
    else if (method.includes('CHEQUE')) totalCheque += amount;
    else totalOther += amount;

    paymentTransactions.push({
      id: pay.id,
      date: pay.paymentDate,
      invoiceNumber: pay.sale?.invoiceNumber || '—',
      saleId: pay.saleId,
      customerName: pay.sale?.customer?.name || 'Walk-in / Cash Sale',
      customerPhone: pay.sale?.customer?.phone || '—',
      doctorName: pay.sale?.doctorRel?.name || pay.sale?.doctor || '—',
      paymentMethod: method,
      referenceNumber: pay.referenceNumber || '—',
      notes: pay.notes || 'Counter Sale Receipt',
      amount,
      totalBillAmount: Number(pay.sale?.totalAmount || amount),
      type: 'SALE_PAYMENT',
      items: (pay.sale?.items || []).map((it) => ({
        productName: it.product?.name || 'Medicine',
        batchNumber: it.batch?.batchNumber || '—',
        expiryDate: it.batch?.expiryDate || null,
        quantity: Number(it.quantity || 0),
        unitName: it.packaging?.name || 'Units',
        unitPrice: Number(it.unitPrice || 0),
        totalAmount: Number(it.totalAmount || 0),
      })),
    });
  }

  // Calculate Sales Returns Cash Refund Outflow
  let totalRefundOutflow = 0;
  const refundTransactions = salesReturns.map((ret) => {
    const amount = Number(ret.totalAmount || 0);
    totalRefundOutflow += amount;
    return {
      id: ret.id,
      date: ret.returnDate,
      returnNumber: ret.returnNumber,
      originalInvoice: ret.sale?.invoiceNumber || '—',
      customerName: ret.customer?.name || 'Walk-in Customer',
      amount,
      reason: ret.reason || 'Customer Return',
    };
  });

  const grossCollection = totalCash + totalUpi + totalCard + totalNetBanking + totalCheque + totalOther;
  const netRegisterCash = Math.max(0, totalCash - totalRefundOutflow);
  const netTotalCollection = grossCollection - totalRefundOutflow;

  // Filter list by search query if present
  let filteredTransactions = paymentTransactions;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filteredTransactions = paymentTransactions.filter(
      (tx) =>
        (tx.invoiceNumber && tx.invoiceNumber.toLowerCase().includes(q)) ||
        (tx.customerName && tx.customerName.toLowerCase().includes(q)) ||
        (tx.customerPhone && tx.customerPhone.includes(q)) ||
        (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(q))
    );
  }

  return {
    period: {
      fromDate: fromDate || null,
      toDate: toDate || null,
    },
    summary: {
      grossCollection,
      totalRefundOutflow,
      netTotalCollection,
      netRegisterCash,
      methodBreakdown: {
        cash: totalCash,
        upi: totalUpi,
        card: totalCard,
        netBanking: totalNetBanking,
        cheque: totalCheque,
        other: totalOther,
      },
      totalReceiptsCount: paymentTransactions.length,
      refundsCount: salesReturns.length,
    },
    transactions: filteredTransactions,
    refunds: refundTransactions,
  };
}

module.exports = {
  getCollectionReport,
};
