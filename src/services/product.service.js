const prisma = require('../config/prisma');

async function getProducts(storeId) {
  return prisma.product.findMany({
    where: { storeId },
    include: {
      category: true,
      manufacturer: true,
      baseUnit: true,
      strengthUnit: true,
    },
    orderBy: {
      name: 'asc',
    },
  });
}

async function getProduct(productId, storeId) {
  return prisma.product.findFirst({
    where: {
      id: productId,
      storeId,
    },
    include: {
      category: true,
      manufacturer: true,
      baseUnit: true,
      strengthUnit: true,
      packaging: true,
      batches: true,
      suppliers: {
        include: {
          supplier: true,
        },
      },
    },
  });
}

async function createProduct(storeId, data) {
  return prisma.product.create({
    data: {
      storeId,
      name: data.name,
      genericName: data.genericName || null,
      brandName: data.brandName || null,
      sku: data.sku,
      barcode: data.barcode || null,
      dosageForm: data.dosageForm || null,
      strength: data.strength ?? null,
      strengthUnitId: data.strengthUnitId || null,
      categoryId: data.categoryId || null,
      manufacturerId: data.manufacturerId || null,
      description: data.description || null,
      gstPercent: data.gstPercent ?? 0,
      baseUnitId: data.baseUnitId,
      minimumStock: data.minimumStock ?? 0,
      reorderLevel: data.reorderLevel ?? 0,
    },
  });
}

module.exports = {
  getProducts,
  getProduct,
  createProduct,
};
