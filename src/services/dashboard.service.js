const prisma = require('../config/prisma');

async function getDashboardSummary(storeId, timeRange = '30d') {
  const now = new Date();

  // Today boundaries
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  // 30 Days From Now for Expiry Alert
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);
  in30Days.setHours(23, 59, 59, 999);

  // Time Range Boundary for Chart
  let chartStartDate = new Date(now);
  if (timeRange === 'today') {
    chartStartDate = new Date(startOfToday);
  } else if (timeRange === '7d') {
    chartStartDate.setDate(chartStartDate.getDate() - 7);
    chartStartDate.setHours(0, 0, 0, 0);
  } else if (timeRange === '30d') {
    chartStartDate.setDate(chartStartDate.getDate() - 30);
    chartStartDate.setHours(0, 0, 0, 0);
  } else if (timeRange === '90d') {
    chartStartDate.setDate(chartStartDate.getDate() - 90);
    chartStartDate.setHours(0, 0, 0, 0);
  } else {
    chartStartDate.setDate(chartStartDate.getDate() - 30);
    chartStartDate.setHours(0, 0, 0, 0);
  }

  const [
    totalProductsCount,
    allStocks,
    todaySalesAgg,
    receivablesAgg,
    payablesAgg,
    expiringBatchesRaw,
    expiredBatchesRaw,
    chartSales,
    saleItemsForMovement,
    collectionsOnSalesAgg,
  ] = await Promise.all([
    // 1. Total Drugs Count
    prisma.product.count({
      where: { storeId, isDeleted: false, status: 'ACTIVE' },
    }),

    // 2. All active Stocks to calculate Inventory Value & Out of Stock / Low Stock
    prisma.stock.findMany({
      where: { storeId, product: { isDeleted: false } },
      include: {
        product: true,
        batch: true,
      },
    }),

    // 3. Today's Sales
    prisma.sale.aggregate({
      where: {
        storeId,
        isDeleted: false,
        invoiceDate: { gte: startOfToday, lte: endOfToday },
        status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
      },
      _sum: { totalAmount: true, paidAmount: true, dueAmount: true },
      _count: { id: true },
    }),

    // 4. Need to Collect (Receivables - Customer Due)
    prisma.sale.aggregate({
      where: {
        storeId,
        isDeleted: false,
        dueAmount: { gt: 0 },
        status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
      },
      _sum: { dueAmount: true },
    }),

    // 5. Need to Pay (Payables - Supplier Due)
    prisma.purchase.aggregate({
      where: {
        storeId,
        isDeleted: false,
        dueAmount: { gt: 0 },
        status: { not: 'CANCELLED' },
      },
      _sum: { dueAmount: true },
    }),

    // 6. Expiring in 30 Days (Active batches between today and +30 days)
    prisma.productBatch.findMany({
      where: {
        storeId,
        product: { isDeleted: false },
        status: 'ACTIVE',
        expiryDate: { gte: startOfToday, lte: in30Days },
      },
      include: {
        product: true,
      },
      orderBy: { expiryDate: 'asc' },
      take: 20,
    }),

    // 7. Expired Batches (Expiry date < startOfToday)
    prisma.productBatch.findMany({
      where: {
        storeId,
        product: { isDeleted: false },
        expiryDate: { lt: startOfToday },
      },
      include: {
        product: true,
      },
      orderBy: { expiryDate: 'desc' },
      take: 20,
    }),

    // 8. Sales for Chart
    prisma.sale.findMany({
      where: {
        storeId,
        isDeleted: false,
        invoiceDate: { gte: chartStartDate, lte: endOfToday },
        status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
      },
      include: {
        items: true,
      },
      orderBy: { invoiceDate: 'asc' },
    }),

    // 9. Sold items for Drug Movement (Fast/Slow Moving & Margins)
    prisma.saleItem.findMany({
      where: {
        sale: {
          storeId,
          isDeleted: false,
          status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
        },
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        batch: true,
      },
      take: 500,
    }),

    // 10. Overall Collections on Sales (Collected vs Credit)
    prisma.sale.aggregate({
      where: {
        storeId,
        isDeleted: false,
        status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
      },
      _sum: {
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
      },
    }),
  ]);

  // Inventory Computations
  let totalInventoryValue = 0;
  let outOfStockCount = 0;
  const lowStockItems = [];

  allStocks.forEach((st) => {
    const qty = Number(st.quantity || 0);
    const cost = Number(st.batch?.costPerBaseUnit || st.batch?.purchasePrice || 0);
    totalInventoryValue += qty * cost;

    const minStock = Number(st.product?.minimumStock || 10);
    if (qty <= 0) {
      outOfStockCount += 1;
    }
    if (qty <= minStock) {
      lowStockItems.push({
        id: st.id,
        drugName: st.product?.name || 'Medicine',
        generic: st.product?.genericName || '—',
        batchNumber: st.batch?.batchNumber || '—',
        quantity: qty,
        minStock,
        unit: st.product?.unit || 'Units',
      });
    }
  });

  // Expired / Expiring Alerts
  const expiredItems = expiredBatchesRaw.map((b) => ({
    id: b.id,
    drugName: b.product?.name || 'Medicine',
    generic: b.product?.genericName || '—',
    batchNumber: b.batchNumber,
    expiryDate: b.expiryDate,
    mrp: Number(b.mrp || 0),
  }));

  const expiringIn30DaysItems = expiringBatchesRaw.map((b) => ({
    id: b.id,
    drugName: b.product?.name || 'Medicine',
    generic: b.product?.genericName || '—',
    batchNumber: b.batchNumber,
    expiryDate: b.expiryDate,
    mrp: Number(b.mrp || 0),
  }));

  // Chart aggregation (Day by Day)
  const chartMap = {};
  chartSales.forEach((sale) => {
    const dateKey = new Date(sale.invoiceDate).toISOString().split('T')[0];
    if (!chartMap[dateKey]) {
      chartMap[dateKey] = {
        date: dateKey,
        label: new Date(dateKey).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        sales: 0,
        cogs: 0,
        profit: 0,
        orders: 0,
      };
    }
    const saleTotal = Number(sale.totalAmount || 0);
    let saleCogs = 0;
    (sale.items || []).forEach((it) => {
      const itemCost = Number(it.costPrice || 0) > 0 ? Number(it.costPrice) * Number(it.quantity || 1) : Number(it.costPerBaseUnit || 0) * Number(it.baseQuantity || it.quantity || 1);
      saleCogs += itemCost;
    });

    chartMap[dateKey].sales += saleTotal;
    chartMap[dateKey].cogs += saleCogs;
    chartMap[dateKey].profit += Math.max(0, saleTotal - saleCogs);
    chartMap[dateKey].orders += 1;
  });

  const chartData = Object.values(chartMap).sort((a, b) => new Date(a.date) - new Date(b.date));

  // If chartData is empty, provide placeholder points
  if (chartData.length === 0) {
    const days = timeRange === '7d' ? 7 : timeRange === 'today' ? 1 : 14;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dKey = d.toISOString().split('T')[0];
      chartData.push({
        date: dKey,
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        sales: 0,
        cogs: 0,
        profit: 0,
        orders: 0,
      });
    }
  }

  // Drug Movement Aggregation
  const productMovementMap = {};
  saleItemsForMovement.forEach((it) => {
    const pId = it.productId || it.product?.name;
    if (!productMovementMap[pId]) {
      productMovementMap[pId] = {
        id: pId,
        name: it.product?.name || 'Medicine',
        generic: it.product?.genericName || '—',
        category: it.product?.category?.name || 'General',
        unitsSold: 0,
        totalRevenue: 0,
        totalCost: 0,
        profitMarginPercent: 0,
      };
    }
    const qty = Number(it.quantity || 0);
    const revenue = Number(it.totalAmount || 0);
    const cost = Number(it.costPrice || 0) > 0 ? Number(it.costPrice) * qty : (Number(it.costPerBaseUnit || 0) * Number(it.baseQuantity || qty));

    productMovementMap[pId].unitsSold += qty;
    productMovementMap[pId].totalRevenue += revenue;
    productMovementMap[pId].totalCost += cost;
  });

  const allMovement = Object.values(productMovementMap).map((item) => {
    const profit = Math.max(0, item.totalRevenue - item.totalCost);
    const margin = item.totalRevenue > 0 ? (profit / item.totalRevenue) * 100 : 0;
    return {
      ...item,
      profit,
      profitMarginPercent: Number(margin.toFixed(1)),
    };
  });

  // Fast Moving (Top 5 by qty)
  const fastMoving = [...allMovement].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
  // Slow Moving (Bottom 5 or low units)
  const slowMoving = [...allMovement].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 5);
  // High Margin (Top 5 by margin %)
  const highMargin = [...allMovement].sort((a, b) => b.profitMarginPercent - a.profitMarginPercent).slice(0, 5);

  // Total Collections Summary
  const totalSalesVal = Number(collectionsOnSalesAgg._sum.totalAmount || 0);
  const totalCollectedVal = Number(collectionsOnSalesAgg._sum.paidAmount || 0);
  const totalOnCreditVal = Number(collectionsOnSalesAgg._sum.dueAmount || 0);
  const collectionRatePercent = totalSalesVal > 0 ? Number(((totalCollectedVal / totalSalesVal) * 100).toFixed(1)) : 0;

  return {
    kpi: {
      totalDrugsCount: totalProductsCount,
      inventoryValue: totalInventoryValue,
      todaySales: Number(todaySalesAgg._sum.totalAmount || 0),
      todayOrdersCount: todaySalesAgg._count.id || 0,
      needToCollect: Number(receivablesAgg._sum.dueAmount || 0),
      needToPay: Number(payablesAgg._sum.dueAmount || 0),
      expiringIn30DaysCount: expiringBatchesRaw.length,
      expiredCount: expiredBatchesRaw.length,
      outOfStockCount,
      lowStockCount: lowStockItems.length,
    },
    alerts: {
      expiredItems,
      expiringIn30DaysItems,
      lowStockItems: lowStockItems.slice(0, 15),
    },
    financialOverview: {
      totalSales: totalSalesVal,
      collected: totalCollectedVal,
      onCredit: totalOnCreditVal,
      collectionRatePercent,
    },
    chart: {
      timeRange,
      data: chartData,
    },
    drugMovement: {
      fastMoving,
      slowMoving,
      highMargin,
    },
  };
}

module.exports = {
  getDashboard: getDashboardSummary,
  getDashboardSummary,
};
