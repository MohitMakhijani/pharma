const prisma = require('../config/prisma');

async function getDashboard(storeId) {
  const now = new Date();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [
    todaySales,
    todayPurchases,
    todaySalePayments,
    todayPurchasePayments,
    outstandingCustomers,
    lowStockProducts,
    expiringBatches,
    recentSales,
    recentPurchases,
  ] = await Promise.all([

    prisma.sale.aggregate({
      where: {
        storeId,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
        status: 'COMPLETED',
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    }),

    prisma.purchase.aggregate({
      where: {
        storeId,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: {
        id: true,
      },
    }),

    prisma.salePayment.aggregate({
      where: {
        sale: {
          storeId,
        },
        paymentDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      _sum: {
        amount: true,
      },
    }),

    prisma.purchasePayment.aggregate({
      where: {
        purchase: {
          storeId,
        },
        paymentDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      _sum: {
        amount: true,
      },
    }),

    prisma.sale.aggregate({
      where: {
        storeId,
        dueAmount: {
          gt: 0,
        },
        status: 'COMPLETED',
      },
      _sum: {
        dueAmount: true,
      },
    }),

    prisma.stock.findMany({
      where: {
        storeId,
        quantity: {
          gt: 0,
        },
      },
      include: {
        product: true,
        batch: true,
      },
    }),

    prisma.productBatch.findMany({
      where: {
        storeId,
        status: 'ACTIVE',
        expiryDate: {
          gte: startOfToday,
        },
      },
      orderBy: {
        expiryDate: 'asc',
      },
      take: 10,
      include: {
        product: true,
      },
    }),

    prisma.sale.findMany({
      where: {
        storeId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        customer: true,
      },
    }),

    prisma.purchase.findMany({
      where: {
        storeId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
      include: {
        supplier: true,
      },
    }),
  ]);

  const lowStock = lowStockProducts.filter((stock) => {
    const quantity = Number(stock.quantity);
    const minimumStock = Number(stock.product.minimumStock || 0);

    return quantity <= minimumStock;
  });

  const stockValue = lowStockProducts.reduce((total, stock) => {
    const quantity = Number(stock.quantity);
    const cost = Number(stock.batch.costPerBaseUnit || 0);

    return total + quantity * cost;
  }, 0);

  return {
    today: {
      sales: Number(todaySales._sum.totalAmount || 0),
      salesCount: todaySales._count.id,

      purchases: Number(todayPurchases._sum.totalAmount || 0),
      purchasesCount: todayPurchases._count.id,

      collections: Number(todaySalePayments._sum.amount || 0),

      purchasePayments: Number(
        todayPurchasePayments._sum.amount || 0
      ),
    },

    outstanding: {
      customerDue: Number(
        outstandingCustomers._sum.dueAmount || 0
      ),
    },

    inventory: {
      stockValue,
      lowStockCount: lowStock.length,
      lowStock: lowStock.map((stock) => ({
        stockId: stock.id,
        productId: stock.productId,
        productName: stock.product.name,
        batchId: stock.batchId,
        batchNumber: stock.batch.batchNumber,
        quantity: Number(stock.quantity),
        minimumStock: Number(stock.product.minimumStock || 0),
      })),
    },

    expiringBatches: expiringBatches.map((batch) => ({
      id: batch.id,
      productId: batch.productId,
      productName: batch.product.name,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
    })),

    recentSales,

    recentPurchases,
  };
}

module.exports = {
  getDashboard,
};
