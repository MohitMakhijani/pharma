const prisma = require('../config/prisma');

async function getSales(storeId) {
  return prisma.sale.findMany({
    where: {
      storeId,
      isDeleted: false,
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
      isDeleted: false,
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
