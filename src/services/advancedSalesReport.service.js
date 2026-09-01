const prisma = require('../config/prisma');

async function getAdvancedSalesReport(storeId, filters = {}) {
  const {
    fromDate,
    toDate,
    doctorId,
    customerId,
    paymentStatus,
    paymentMethod,
    categoryId,
    status,
    search,
  } = filters;

  const dateFilter = {};
  if (fromDate || toDate) {
    if (fromDate) dateFilter.gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate) dateFilter.lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  const where = {
    storeId,
    ...(status && status !== 'ALL' ? { status } : { status: { in: ['COMPLETED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'] } }),
    ...(paymentStatus && paymentStatus !== 'ALL' ? { paymentStatus } : {}),
    ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
    ...(doctorId && doctorId !== 'ALL' ? { doctorId } : {}),
    ...(customerId && customerId !== 'ALL' ? { customerId } : {}),
  };

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: 'insensitive' } },
      { customer: { name: { contains: q, mode: 'insensitive' } } },
      { customer: { phone: { contains: q, mode: 'insensitive' } } },
      { doctorRel: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      customer: true,
      doctorRel: true,
      payments: true,
      items: {
        include: {
          product: {
            include: {
              category: true,
              suppliers: {
                include: {
                  supplier: true,
                },
              },
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

  // Calculate Overall Metrics
  let totalGrossRevenue = 0;
  let totalDiscount = 0;
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalNetRevenue = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let totalCostOfGoods = 0;
  let totalItemsSold = 0;

  // Breakdown Maps
  const doctorSalesMap = {};
  const categorySalesMap = {};
  const customerSalesMap = {};
  const supplierSalesMap = {};
  const topProductSalesMap = {};
  const dailyTrendsMap = {};

  for (const sale of sales) {
    const saleTotal = Number(sale.totalAmount || 0);
    const salePaid = Number(sale.paidAmount || 0);
    const saleDue = Number(sale.dueAmount || 0);
    const saleDisc = Number(sale.discountAmount || 0);
    const saleTaxable = Number(sale.taxableAmount || 0);
    const saleCgst = Number(sale.cgstAmount || 0);
    const saleSgst = Number(sale.sgstAmount || 0);
    const saleIgst = Number(sale.igstAmount || 0);

    totalGrossRevenue += (saleTotal + saleDisc);
    totalDiscount += saleDisc;
    totalTaxable += saleTaxable;
    totalCgst += saleCgst;
    totalSgst += saleSgst;
    totalIgst += saleIgst;
    totalNetRevenue += saleTotal;
    totalPaid += salePaid;
    totalDue += saleDue;

    // Daily trend
    const dateKey = sale.invoiceDate ? new Date(sale.invoiceDate).toISOString().split('T')[0] : 'Unknown';
    if (!dailyTrendsMap[dateKey]) {
      dailyTrendsMap[dateKey] = { date: dateKey, invoices: 0, revenue: 0, profit: 0 };
    }
    dailyTrendsMap[dateKey].invoices += 1;
    dailyTrendsMap[dateKey].revenue += saleTotal;

    // Doctor aggregation
    const docName = sale.doctorRel?.name || sale.doctor || 'Walk-in / Over-the-Counter';
    const docId = sale.doctorId || docName;
    if (!doctorSalesMap[docId]) {
      doctorSalesMap[docId] = {
        id: docId,
        doctor: docName,
        registrationNo: sale.doctorRel?.registrationNo || '—',
        phone: sale.doctorRel?.phone || '—',
        invoices: 0,
        revenue: 0,
        medicinesSold: 0,
      };
    }
    doctorSalesMap[docId].invoices += 1;
    doctorSalesMap[docId].revenue += saleTotal;

    // Customer aggregation
    const custName = sale.customer?.name || 'Walk-in / Cash';
    const custId = sale.customerId || custName;
    if (!customerSalesMap[custId]) {
      customerSalesMap[custId] = {
        id: custId,
        name: custName,
        phone: sale.customer?.phone || '—',
        email: sale.customer?.email || '—',
        gstin: sale.customer?.gstin || '—',
        invoices: 0,
        revenue: 0,
        paid: 0,
        due: 0,
      };
    }
    customerSalesMap[custId].invoices += 1;
    customerSalesMap[custId].revenue += saleTotal;
    customerSalesMap[custId].paid += salePaid;
    customerSalesMap[custId].due += saleDue;

    // Line items processing
    for (const item of sale.items) {
      const qty = Number(item.quantity || 0);
      const itemCost = Number(item.costPrice || 0) * qty;
      const itemPrice = Number(item.totalAmount || 0);
      const itemProfit = itemPrice - itemCost;

      totalItemsSold += qty;
      totalCostOfGoods += itemCost;
      dailyTrendsMap[dateKey].profit += itemProfit;
      doctorSalesMap[docId].medicinesSold += qty;

      // Product aggregation
      const prodName = item.product?.name || 'Medicine';
      const prodId = item.productId || prodName;
      if (!topProductSalesMap[prodId]) {
        topProductSalesMap[prodId] = {
          id: prodId,
          name: prodName,
          generic: item.product?.genericName || '—',
          sku: item.product?.sku || '—',
          category: item.product?.category?.name || 'General',
          quantity: 0,
          revenue: 0,
          profit: 0,
          cost: 0,
        };
      }
      topProductSalesMap[prodId].quantity += qty;
      topProductSalesMap[prodId].revenue += itemPrice;
      topProductSalesMap[prodId].cost += itemCost;
      topProductSalesMap[prodId].profit += itemProfit;

      // Category sales
      const catName = item.product?.category?.name || 'General Medicines';
      if (!categorySalesMap[catName]) {
        categorySalesMap[catName] = { category: catName, quantity: 0, revenue: 0, profit: 0 };
      }
      categorySalesMap[catName].quantity += qty;
      categorySalesMap[catName].revenue += itemPrice;
      categorySalesMap[catName].profit += itemProfit;

      // Supplier distribution for this product
      const productSuppliers = item.product?.suppliers || [];
      const primarySupplier = productSuppliers.find((s) => s.isPreferred) || productSuppliers[0];
      const supName = primarySupplier?.supplier?.name || 'General / Unassigned Distributor';
      const supId = primarySupplier?.supplierId || supName;

      if (!supplierSalesMap[supId]) {
        supplierSalesMap[supId] = {
          id: supId,
          supplierName: supName,
          phone: primarySupplier?.supplier?.phone || '—',
          gstin: primarySupplier?.supplier?.gstin || '—',
          quantitySold: 0,
          salesRevenue: 0,
          procurementCost: 0,
          grossMargin: 0,
        };
      }
      supplierSalesMap[supId].quantitySold += qty;
      supplierSalesMap[supId].salesRevenue += itemPrice;
      supplierSalesMap[supId].procurementCost += itemCost;
      supplierSalesMap[supId].grossMargin += itemProfit;
    }
  }

  const grossProfit = totalNetRevenue - totalCostOfGoods;
  const profitMarginPercent = totalNetRevenue > 0 ? ((grossProfit / totalNetRevenue) * 100).toFixed(1) : 0;
  const avgOrderValue = sales.length > 0 ? (totalNetRevenue / sales.length).toFixed(2) : 0;

  return {
    period: { fromDate, toDate },
    summary: {
      totalInvoices: sales.length,
      totalGrossRevenue,
      totalDiscount,
      totalTaxable,
      totalGst: totalCgst + totalSgst + totalIgst,
      totalNetRevenue,
      totalPaid,
      totalDue,
      totalCostOfGoods,
      grossProfit,
      profitMarginPercent: Number(profitMarginPercent),
      avgOrderValue: Number(avgOrderValue),
      totalItemsSold,
    },
    dailyTrends: Object.values(dailyTrendsMap).sort((a, b) => b.date.localeCompare(a.date)),
    topProducts: Object.values(topProductSalesMap).sort((a, b) => b.revenue - a.revenue),
    customerPerformance: Object.values(customerSalesMap).sort((a, b) => b.revenue - a.revenue),
    supplierPerformance: Object.values(supplierSalesMap).sort((a, b) => b.salesRevenue - a.salesRevenue),
    doctorPerformance: Object.values(doctorSalesMap).sort((a, b) => b.revenue - a.revenue),
    categoryBreakdown: Object.values(categorySalesMap).sort((a, b) => b.revenue - a.revenue),
    invoices: sales.map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      invoiceDate: s.invoiceDate,
      customerName: s.customer?.name || 'Walk-in Customer',
      customerPhone: s.customer?.phone || '—',
      doctorName: s.doctorRel?.name || s.doctor || '—',
      itemCount: s.items.length,
      subtotal: Number(s.subtotal || 0),
      discountAmount: Number(s.discountAmount || 0),
      taxAmount: Number(s.cgstAmount || 0) + Number(s.sgstAmount || 0) + Number(s.igstAmount || 0),
      totalAmount: Number(s.totalAmount || 0),
      paidAmount: Number(s.paidAmount || 0),
      dueAmount: Number(s.dueAmount || 0),
      status: s.status,
      paymentStatus: s.paymentStatus,
      items: s.items.map((it) => ({
        id: it.id,
        name: it.product?.name || 'Medicine',
        genericName: it.product?.genericName || '—',
        batchNumber: it.batch?.batchNumber || '—',
        expiryDate: it.batch?.expiryDate || null,
        quantity: Number(it.quantity || 0),
        unitName: it.packaging?.name || 'Units',
        unitPrice: Number(it.unitPrice || 0),
        costPrice: Number(it.costPrice || 0),
        discountPercent: Number(it.discountPercent || 0),
        totalAmount: Number(it.totalAmount || 0),
        profit: Number(it.totalAmount || 0) - (Number(it.costPrice || 0) * Number(it.quantity || 0)),
      })),
    })),
  };
}

module.exports = {
  getAdvancedSalesReport,
};
