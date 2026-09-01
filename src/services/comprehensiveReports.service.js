const prisma = require('../config/prisma');

// 1. Margin Reports
async function getMarginReports(storeId, filters = {}) {
  const { fromDate, toDate, type = 'item' } = filters;
  const dateFilter = {};
  if (fromDate) dateFilter.gte = new Date(`${fromDate}T00:00:00.000Z`);
  if (toDate) dateFilter.lte = new Date(`${toDate}T23:59:59.999Z`);

  if (type === 'bill-item') {
    // Bill-Item wise Margin
    const sales = await prisma.sale.findMany({
      where: {
        storeId,
        status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
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
      orderBy: { invoiceDate: 'desc' },
      take: 200,
    });

    const rows = [];
    sales.forEach((sale) => {
      (sale.items || []).forEach((it) => {
        const qty = Number(it.quantity || 0);
        const revenue = Number(it.totalAmount || 0);
        const costPrice = Number(it.costPrice || 0) > 0 ? Number(it.costPrice) * qty : (Number(it.costPerBaseUnit || 0) * Number(it.baseQuantity || qty));
        const profit = Math.max(0, revenue - costPrice);
        const marginPct = revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0;

        rows.push({
          id: it.id,
          invoiceNumber: sale.invoiceNumber,
          date: sale.invoiceDate,
          customerName: sale.customer?.name || 'Walk-in',
          drugName: it.product?.name || 'Medicine',
          batchNumber: it.batch?.batchNumber || '—',
          quantity: qty,
          unitPrice: Number(it.unitPrice || 0),
          costPrice,
          revenue,
          profit,
          marginPct,
        });
      });
    });

    return { type: 'bill-item', items: rows };
  } else if (type === 'purchase-analysis') {
    // Purchase Analysis Report
    const purchases = await prisma.purchase.findMany({
      where: {
        storeId,
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
      orderBy: { invoiceDate: 'desc' },
    });

    const supplierMap = {};
    purchases.forEach((p) => {
      const sName = p.supplier?.name || 'Unassigned';
      if (!supplierMap[sName]) {
        supplierMap[sName] = {
          supplierName: sName,
          billsCount: 0,
          totalAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          itemsCount: 0,
        };
      }
      supplierMap[sName].billsCount += 1;
      supplierMap[sName].totalAmount += Number(p.totalAmount || 0);
      supplierMap[sName].paidAmount += Number(p.paidAmount || 0);
      supplierMap[sName].dueAmount += Number(p.dueAmount || 0);
      supplierMap[sName].itemsCount += p.items.length;
    });

    return { type: 'purchase-analysis', suppliers: Object.values(supplierMap) };
  } else {
    // Item wise margin (Default)
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          storeId,
          status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
          ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
        },
      },
      include: {
        product: { include: { category: true } },
        batch: true,
      },
    });

    const productMap = {};
    saleItems.forEach((it) => {
      const pId = it.productId || it.product?.name;
      if (!productMap[pId]) {
        productMap[pId] = {
          productId: pId,
          drugName: it.product?.name || 'Medicine',
          generic: it.product?.genericName || '—',
          category: it.product?.category?.name || 'General',
          unitsSold: 0,
          totalRevenue: 0,
          totalCost: 0,
        };
      }
      const qty = Number(it.quantity || 0);
      const revenue = Number(it.totalAmount || 0);
      const cost = Number(it.costPrice || 0) > 0 ? Number(it.costPrice) * qty : (Number(it.costPerBaseUnit || 0) * Number(it.baseQuantity || qty));

      productMap[pId].unitsSold += qty;
      productMap[pId].totalRevenue += revenue;
      productMap[pId].totalCost += cost;
    });

    const items = Object.values(productMap).map((p) => {
      const profit = Math.max(0, p.totalRevenue - p.totalCost);
      const marginPct = p.totalRevenue > 0 ? Number(((profit / p.totalRevenue) * 100).toFixed(1)) : 0;
      return {
        ...p,
        profit,
        marginPct,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    return { type: 'item', items };
  }
}

// 2. Stock Reports (Expiry, Non-Moving, Item-Batch Stock, Ageing, Stock Movement)
async function getStockReports(storeId, filters = {}) {
  const { subType = 'item-batch' } = filters;
  const now = new Date();

  if (subType === 'expiry') {
    // Expiry Report
    const in90Days = new Date(now);
    in90Days.setDate(in90Days.getDate() + 90);

    const batches = await prisma.productBatch.findMany({
      where: {
        storeId,
        status: 'ACTIVE',
      },
      include: {
        product: true,
        stocks: true,
      },
      orderBy: { expiryDate: 'asc' },
    });

    const formatted = batches.map((b) => {
      const stockQty = (b.stocks || []).reduce((sum, s) => sum + Number(s.quantity || 0), 0);
      const isExpired = new Date(b.expiryDate) < now;
      const daysLeft = Math.ceil((new Date(b.expiryDate) - now) / (1000 * 60 * 60 * 24));

      return {
        id: b.id,
        drugName: b.product?.name || 'Medicine',
        generic: b.product?.genericName || '—',
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        mrp: Number(b.mrp || 0),
        purchasePrice: Number(b.purchasePrice || 0),
        stockQty,
        isExpired,
        daysLeft,
        status: isExpired ? 'EXPIRED' : daysLeft <= 30 ? 'CRITICAL (≤30d)' : daysLeft <= 90 ? 'NEAR EXPIRY (≤90d)' : 'SAFE',
      };
    });

    return { subType: 'expiry', items: formatted };
  } else if (subType === 'non-moving') {
    // Non-moving items (Stocks with 0 or very low sales in last 60 days)
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [allStocks, recentSalesItems] = await Promise.all([
      prisma.stock.findMany({
        where: { storeId, quantity: { gt: 0 } },
        include: { product: true, batch: true },
      }),
      prisma.saleItem.findMany({
        where: {
          sale: {
            storeId,
            invoiceDate: { gte: sixtyDaysAgo },
            status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
          },
        },
        select: { productId: true, quantity: true },
      }),
    ]);

    const soldProductIds = new Set(recentSalesItems.map((s) => s.productId));
    const nonMoving = allStocks.filter((st) => !soldProductIds.has(st.productId)).map((st) => ({
      id: st.id,
      drugName: st.product?.name || 'Medicine',
      generic: st.product?.genericName || '—',
      batchNumber: st.batch?.batchNumber || '—',
      quantity: Number(st.quantity || 0),
      purchasePrice: Number(st.batch?.purchasePrice || 0),
      mrp: Number(st.batch?.mrp || 0),
      totalValue: Number(st.quantity || 0) * Number(st.batch?.purchasePrice || 0),
      lastMovement: 'No sales in 60+ days',
    }));

    return { subType: 'non-moving', items: nonMoving };
  } else if (subType === 'inventory-ageing') {
    // Inventory Ageing (0-30, 31-60, 61-90, 90+ days)
    const batches = await prisma.productBatch.findMany({
      where: { storeId, status: 'ACTIVE' },
      include: { product: true, stocks: true },
    });

    const agedItems = batches.map((b) => {
      const stockQty = (b.stocks || []).reduce((sum, s) => sum + Number(s.quantity || 0), 0);
      const createdAt = new Date(b.createdAt || now);
      const ageDays = Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));
      const ageBracket = ageDays <= 30 ? '0-30 Days' : ageDays <= 60 ? '31-60 Days' : ageDays <= 90 ? '61-90 Days' : '90+ Days (Aged)';

      return {
        id: b.id,
        drugName: b.product?.name || 'Medicine',
        batchNumber: b.batchNumber,
        stockQty,
        ageDays,
        ageBracket,
        purchasePrice: Number(b.purchasePrice || 0),
        totalValuation: stockQty * Number(b.purchasePrice || 0),
      };
    });

    return { subType: 'inventory-ageing', items: agedItems };
  } else {
    // Default Item-Batch wise Stock
    const stocks = await prisma.stock.findMany({
      where: { storeId },
      include: {
        product: { include: { category: true } },
        batch: true,
      },
      orderBy: { product: { name: 'asc' } },
    });

    const items = stocks.map((s) => ({
      id: s.id,
      drugName: s.product?.name || 'Medicine',
      generic: s.product?.genericName || '—',
      category: s.product?.category?.name || 'General',
      batchNumber: s.batch?.batchNumber || '—',
      expiryDate: s.batch?.expiryDate,
      quantity: Number(s.quantity || 0),
      costPrice: Number(s.batch?.purchasePrice || s.batch?.costPerBaseUnit || 0),
      mrp: Number(s.batch?.mrp || 0),
      totalValue: Number(s.quantity || 0) * Number(s.batch?.purchasePrice || s.batch?.costPerBaseUnit || 0),
    }));

    return { subType: 'item-batch', items };
  }
}

// 3. eNtelligent Reports (Monthly Sales Overview, Top Items, Top Customers, Top Distributors, Stock Valuation)
async function getEntelligentReports(storeId, filters = {}) {
  const { subType = 'top-selling' } = filters;

  if (subType === 'monthly-overview') {
    const sales = await prisma.sale.findMany({
      where: {
        storeId,
        status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] },
      },
      select: {
        invoiceDate: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
      },
    });

    const monthMap = {};
    sales.forEach((s) => {
      const d = new Date(s.invoiceDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

      if (!monthMap[key]) {
        monthMap[key] = { monthKey: key, label, totalSales: 0, collected: 0, due: 0, count: 0 };
      }
      monthMap[key].totalSales += Number(s.totalAmount || 0);
      monthMap[key].collected += Number(s.paidAmount || 0);
      monthMap[key].due += Number(s.dueAmount || 0);
      monthMap[key].count += 1;
    });

    return { subType: 'monthly-overview', monthlyData: Object.values(monthMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey)) };
  } else if (subType === 'top-customers') {
    const customers = await prisma.customer.findMany({
      where: { storeId },
      include: {
        sales: {
          where: { status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } },
        },
      },
    });

    const ranked = customers.map((c) => {
      const totalSpent = (c.sales || []).reduce((sum, s) => sum + Number(s.totalAmount || 0), 0);
      const billsCount = (c.sales || []).length;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone || '—',
        email: c.email || '—',
        billsCount,
        totalSpent,
      };
    }).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 20);

    return { subType: 'top-customers', customers: ranked };
  } else if (subType === 'top-distributors') {
    const suppliers = await prisma.supplier.findMany({
      where: { storeId },
      include: {
        purchases: true,
      },
    });

    const ranked = suppliers.map((sup) => {
      const totalPurchases = (sup.purchases || []).reduce((sum, p) => sum + Number(p.totalAmount || 0), 0);
      const paid = (sup.purchases || []).reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
      const due = (sup.purchases || []).reduce((sum, p) => sum + Number(p.dueAmount || 0), 0);

      return {
        id: sup.id,
        name: sup.name,
        phone: sup.phone || '—',
        gstin: sup.gstin || '—',
        ordersCount: sup.purchases.length,
        totalPurchases,
        paid,
        due,
      };
    }).sort((a, b) => b.totalPurchases - a.totalPurchases).slice(0, 20);

    return { subType: 'top-distributors', distributors: ranked };
  } else {
    // Default Top Selling Items
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: { storeId, status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } },
      },
      include: {
        product: { include: { category: true } },
      },
    });

    const productMap = {};
    saleItems.forEach((it) => {
      const pId = it.productId || it.product?.name;
      if (!productMap[pId]) {
        productMap[pId] = {
          productId: pId,
          name: it.product?.name || 'Medicine',
          generic: it.product?.genericName || '—',
          category: it.product?.category?.name || 'General',
          unitsSold: 0,
          totalRevenue: 0,
        };
      }
      productMap[pId].unitsSold += Number(it.quantity || 0);
      productMap[pId].totalRevenue += Number(it.totalAmount || 0);
    });

    const topSelling = Object.values(productMap).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 25);
    return { subType: 'top-selling', items: topSelling };
  }
}

// 4. Others Reports (Doctor-Item Summary, Schedule Report, Staff Activity, Sales Summary)
async function getOthersReports(storeId, filters = {}) {
  const { subType = 'doctor-summary' } = filters;

  if (subType === 'doctor-summary') {
    const doctors = await prisma.doctor.findMany({
      where: { storeId },
      include: {
        sales: {
          include: {
            items: {
              include: { product: true },
            },
          },
        },
      },
    });

    const doctorSummary = doctors.map((doc) => {
      const rxCount = (doc.sales || []).length;
      let totalRxValue = 0;
      let totalPrescribedUnits = 0;

      (doc.sales || []).forEach((s) => {
        totalRxValue += Number(s.totalAmount || 0);
        (s.items || []).forEach((it) => {
          totalPrescribedUnits += Number(it.quantity || 0);
        });
      });

      return {
        id: doc.id,
        doctorName: doc.name,
        regNo: doc.registrationNumber || '—',
        specialization: doc.specialization || 'General Physician',
        hospital: doc.hospital || '—',
        phone: doc.phone || '—',
        rxCount,
        totalPrescribedUnits,
        totalRxValue,
      };
    }).sort((a, b) => b.totalRxValue - a.totalRxValue);

    return { subType: 'doctor-summary', doctors: doctorSummary };
  } else if (subType === 'staff-activity') {
    const users = await prisma.user.findMany({
      where: { storeId },
      include: { role: true },
    });

    const staffSummary = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email || '—',
      phone: u.phone || '—',
      role: u.role?.name || 'Staff Member',
      status: u.status,
      lastActive: 'Active today',
    }));

    return { subType: 'staff-activity', staff: staffSummary };
  } else {
    // Default Sales Summary
    const sales = await prisma.sale.findMany({
      where: { storeId, status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } },
      orderBy: { invoiceDate: 'desc' },
      take: 100,
      include: { customer: true },
    });

    return { subType: 'sales-summary', sales };
  }
}

// 5. Accounting Reports (Ledger Balances, Customer Dues, Supplier Liabilities, P&L Summary)
async function getAccountingReports(storeId) {
  const [customersAgg, suppliersAgg, salesAgg, purchasesAgg] = await Promise.all([
    prisma.sale.aggregate({
      where: { storeId, dueAmount: { gt: 0 }, status: { not: 'CANCELLED' } },
      _sum: { dueAmount: true },
      _count: { id: true },
    }),
    prisma.purchase.aggregate({
      where: { storeId, dueAmount: { gt: 0 }, status: { not: 'CANCELLED' } },
      _sum: { dueAmount: true },
      _count: { id: true },
    }),
    prisma.sale.aggregate({
      where: { storeId, status: { in: ['COMPLETED', 'PARTIALLY_RETURNED'] } },
      _sum: { totalAmount: true, paidAmount: true, cgstAmount: true, sgstAmount: true },
    }),
    prisma.purchase.aggregate({
      where: { storeId, status: { not: 'CANCELLED' } },
      _sum: { totalAmount: true, paidAmount: true, cgstAmount: true, sgstAmount: true },
    }),
  ]);

  const totalSales = Number(salesAgg._sum.totalAmount || 0);
  const totalPurchases = Number(purchasesAgg._sum.totalAmount || 0);
  const grossProfit = Math.max(0, totalSales - totalPurchases);

  return {
    receivables: {
      totalCustomerDue: Number(customersAgg._sum.dueAmount || 0),
      unpaidBillsCount: customersAgg._count.id || 0,
    },
    payables: {
      totalSupplierDue: Number(suppliersAgg._sum.dueAmount || 0),
      pendingInvoicesCount: suppliersAgg._count.id || 0,
    },
    plSummary: {
      totalRevenue: totalSales,
      totalProcurementCost: totalPurchases,
      grossProfit,
      gstCollected: Number(salesAgg._sum.cgstAmount || 0) + Number(salesAgg._sum.sgstAmount || 0),
      itcClaimable: Number(purchasesAgg._sum.cgstAmount || 0) + Number(purchasesAgg._sum.sgstAmount || 0),
    },
  };
}

module.exports = {
  getMarginReports,
  getStockReports,
  getEntelligentReports,
  getOthersReports,
  getAccountingReports,
};
