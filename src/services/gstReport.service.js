const prisma = require('../config/prisma');

async function getGstReport(storeId, filters = {}) {
  const { fromDate, toDate, month, year } = filters;

  const dateFilter = {};
  if (fromDate || toDate) {
    if (fromDate) dateFilter.gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate) dateFilter.lte = new Date(`${toDate}T23:59:59.999Z`);
  } else if (month && year) {
    const startDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(Number(year), Number(month), 0, 23, 59, 59, 999));
    dateFilter.gte = startDate;
    dateFilter.lte = endDate;
  }

  // 1. Fetch Sales with SaleItems and Products for GSTR-1 Outward Supplies
  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      status: { in: ['COMPLETED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'] },
      ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
    },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
          batch: true,
        },
      },
    },
    orderBy: {
      invoiceDate: 'desc',
    },
  });

  // 2. Fetch Sales Returns for Credit Notes Adjustment
  const salesReturns = await prisma.salesReturn.findMany({
    where: {
      storeId,
      status: 'COMPLETED',
      ...(Object.keys(dateFilter).length > 0 ? { returnDate: dateFilter } : {}),
    },
    include: {
      customer: true,
      sale: true,
      items: {
        include: {
          product: true,
          batch: true,
        },
      },
    },
    orderBy: {
      returnDate: 'desc',
    },
  });

  // 3. Fetch Purchases for GSTR-3B Input Tax Credit (ITC)
  const purchases = await prisma.purchase.findMany({
    where: {
      storeId,
      status: { in: ['RECEIVED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'] },
      ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
    },
    include: {
      supplier: true,
      items: {
        include: {
          product: true,
          batch: true,
        },
      },
    },
    orderBy: {
      invoiceDate: 'desc',
    },
  });

  // Aggregate Sales (Outward Supplies)
  let totalSalesTaxable = 0;
  let totalSalesCgst = 0;
  let totalSalesSgst = 0;
  let totalSalesIgst = 0;
  let totalSalesTotal = 0;

  // Rate-wise bucket: { "0": { taxable, cgst, sgst, igst, total }, "5": ..., "12": ..., "18": ..., "28": ... }
  const rateWiseBuckets = {};
  // HSN-wise bucket: { "3004": { hsn, description, uqc, totalQty, taxable, cgst, sgst, igst, total } }
  const hsnBuckets = {};

  const b2bInvoices = [];
  const b2cInvoices = [];

  for (const sale of sales) {
    const isB2B = Boolean(sale.customer?.gstin && sale.customer.gstin.trim());
    let invTaxable = 0;
    let invCgst = 0;
    let invSgst = 0;
    let invIgst = 0;

    for (const item of sale.items) {
      const taxable = Number(item.taxableAmount || (Number(item.quantity) * Number(item.unitPrice) - Number(item.discountAmount || 0)));
      const cgst = Number(item.cgstAmount || 0);
      const sgst = Number(item.sgstAmount || 0);
      const igst = Number(item.igstAmount || 0);
      const totalTax = cgst + sgst + igst;
      const rate = Number(item.cgstPercent || 0) + Number(item.sgstPercent || 0) + Number(item.igstPercent || 0);
      const rateKey = rate.toFixed(1).replace(/\.0$/, '') + '%';

      invTaxable += taxable;
      invCgst += cgst;
      invSgst += sgst;
      invIgst += igst;

      // Rate bucket
      if (!rateWiseBuckets[rateKey]) {
        rateWiseBuckets[rateKey] = { rate: rateKey, rateNum: rate, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
      }
      rateWiseBuckets[rateKey].taxable += taxable;
      rateWiseBuckets[rateKey].cgst += cgst;
      rateWiseBuckets[rateKey].sgst += sgst;
      rateWiseBuckets[rateKey].igst += igst;
      rateWiseBuckets[rateKey].total += (taxable + totalTax);

      // HSN summary
      const hsnCode = item.product?.hsnCode || '3004';
      if (!hsnBuckets[hsnCode]) {
        hsnBuckets[hsnCode] = {
          hsn: hsnCode,
          description: item.product?.name || 'Medicaments',
          uqc: 'BOX/TAB',
          totalQty: 0,
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total: 0,
        };
      }
      hsnBuckets[hsnCode].totalQty += Number(item.quantity || 0);
      hsnBuckets[hsnCode].taxable += taxable;
      hsnBuckets[hsnCode].cgst += cgst;
      hsnBuckets[hsnCode].sgst += sgst;
      hsnBuckets[hsnCode].igst += igst;
      hsnBuckets[hsnCode].total += (taxable + totalTax);
    }

    totalSalesTaxable += invTaxable;
    totalSalesCgst += invCgst;
    totalSalesSgst += invSgst;
    totalSalesIgst += invIgst;
    totalSalesTotal += Number(sale.totalAmount || (invTaxable + invCgst + invSgst + invIgst));

    const invoiceRow = {
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      invoiceDate: sale.invoiceDate,
      customerName: sale.customer?.name || 'Walk-in Customer',
      customerGstin: sale.customer?.gstin || '—',
      placeOfSupply: sale.customer?.state || 'State',
      taxableValue: invTaxable,
      cgst: invCgst,
      sgst: invSgst,
      igst: invIgst,
      totalTax: invCgst + invSgst + invIgst,
      invoiceValue: Number(sale.totalAmount || 0),
    };

    if (isB2B) {
      b2bInvoices.push(invoiceRow);
    } else {
      b2cInvoices.push(invoiceRow);
    }
  }

  // Aggregate Sales Returns (Credit Notes)
  let totalReturnTaxable = 0;
  let totalReturnCgst = 0;
  let totalReturnSgst = 0;
  let totalReturnIgst = 0;
  let totalReturnTotal = 0;

  const creditNotes = salesReturns.map((ret) => {
    let retTaxable = 0;
    let retCgst = 0;
    let retSgst = 0;
    let retIgst = 0;

    for (const item of ret.items) {
      const taxable = Number(item.totalAmount || 0);
      retTaxable += taxable;
    }

    // Default approximation if item level tax isn't recorded on return
    retCgst = retTaxable * 0.06; // Standard 12% GST split
    retSgst = retTaxable * 0.06;

    totalReturnTaxable += retTaxable;
    totalReturnCgst += retCgst;
    totalReturnSgst += retSgst;
    totalReturnIgst += retIgst;
    totalReturnTotal += Number(ret.totalAmount || 0);

    return {
      id: ret.id,
      returnNumber: ret.returnNumber,
      returnDate: ret.returnDate,
      originalInvoice: ret.sale?.invoiceNumber || '—',
      customerName: ret.customer?.name || 'Walk-in Customer',
      customerGstin: ret.customer?.gstin || '—',
      taxableValue: retTaxable,
      cgst: retCgst,
      sgst: retSgst,
      igst: retIgst,
      totalRefund: Number(ret.totalAmount || 0),
    };
  });

  // Aggregate Purchases (Input Tax Credit - ITC)
  let totalPurchaseTaxable = 0;
  let totalPurchaseCgst = 0;
  let totalPurchaseSgst = 0;
  let totalPurchaseIgst = 0;
  let totalPurchaseTotal = 0;

  for (const pur of purchases) {
    const taxable = Number(pur.taxableAmount || (Number(pur.totalAmount || 0) - Number(pur.cgstAmount || 0) - Number(pur.sgstAmount || 0) - Number(pur.igstAmount || 0)));
    const cgst = Number(pur.cgstAmount || 0);
    const sgst = Number(pur.sgstAmount || 0);
    const igst = Number(pur.igstAmount || 0);

    totalPurchaseTaxable += taxable;
    totalPurchaseCgst += cgst;
    totalPurchaseSgst += sgst;
    totalPurchaseIgst += igst;
    totalPurchaseTotal += Number(pur.totalAmount || 0);
  }

  // Net Tax Liability calculation (Outward Tax minus ITC eligible)
  const netCgstLiability = Math.max(0, (totalSalesCgst - totalReturnCgst) - totalPurchaseCgst);
  const netSgstLiability = Math.max(0, (totalSalesSgst - totalReturnSgst) - totalPurchaseSgst);
  const netIgstLiability = Math.max(0, (totalSalesIgst - totalReturnIgst) - totalPurchaseIgst);
  const totalNetPayable = netCgstLiability + netSgstLiability + netIgstLiability;

  return {
    period: {
      fromDate: fromDate || null,
      toDate: toDate || null,
      month: month || null,
      year: year || null,
    },
    summary: {
      outwardSupplies: {
        taxable: totalSalesTaxable,
        cgst: totalSalesCgst,
        sgst: totalSalesSgst,
        igst: totalSalesIgst,
        totalTax: totalSalesCgst + totalSalesSgst + totalSalesIgst,
        totalValue: totalSalesTotal,
        invoiceCount: sales.length,
      },
      creditNotes: {
        taxable: totalReturnTaxable,
        cgst: totalReturnCgst,
        sgst: totalReturnSgst,
        igst: totalReturnIgst,
        totalTax: totalReturnCgst + totalReturnSgst + totalReturnIgst,
        totalValue: totalReturnTotal,
        count: salesReturns.length,
      },
      inputTaxCredit: {
        taxable: totalPurchaseTaxable,
        cgst: totalPurchaseCgst,
        sgst: totalPurchaseSgst,
        igst: totalPurchaseIgst,
        totalItc: totalPurchaseCgst + totalPurchaseSgst + totalPurchaseIgst,
        totalValue: totalPurchaseTotal,
        purchaseCount: purchases.length,
      },
      netLiability: {
        cgst: netCgstLiability,
        sgst: netSgstLiability,
        igst: netIgstLiability,
        totalPayable: totalNetPayable,
      },
    },
    rateWiseSummary: Object.values(rateWiseBuckets).sort((a, b) => a.rateNum - b.rateNum),
    hsnSummary: Object.values(hsnBuckets),
    b2bInvoices,
    b2cInvoices,
    creditNotes,
  };
}

module.exports = {
  getGstReport,
};
