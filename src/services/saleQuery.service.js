const prisma = require('../config/prisma');

async function getSales(storeId) {
  return prisma.sale.findMany({
    where: {
      storeId,
    },
    orderBy: {
      createdAt: 'desc',
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
  });
}


async function getSaleById(saleId, storeId) {

  return prisma.sale.findFirst({
    where: {
      id: saleId,
      storeId,
    },
    include: {
      customer: true,
      items: {
        include: {
          product: true,
          batch: true,
        },
      },
      payments: true,
    },
  });

}


module.exports = {
  getSales,
  getSaleById,
};
