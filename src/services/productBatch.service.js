const prisma = require('../config/prisma');

async function getProductBatches(productId, storeId) {
  return prisma.productBatch.findMany({
    where: {
      productId,
      storeId,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
      suppliers: {
        include: {
          supplier: true,
        },
      },
    },
    orderBy: {
      expiryDate: 'asc',
    },
  });
}

async function getProductBatch(batchId, storeId) {
  return prisma.productBatch.findFirst({
    where: {
      id: batchId,
      storeId,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
      suppliers: {
        include: {
          supplier: true,
        },
      },
      stocks: true,
    },
  });
}

async function createProductBatch(storeId, productId, data) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      storeId,
    },
  });

  if (!product) {
    const error = new Error('Product not found');
    error.statusCode = 404;
    throw error;
  }

  return prisma.productBatch.create({
    data: {
      storeId,
      productId,
      batchNumber: data.batchNumber,
      manufacturingDate: data.manufacturingDate
        ? new Date(data.manufacturingDate)
        : null,
      expiryDate: new Date(data.expiryDate),
      purchasePrice: data.purchasePrice,
      costPerBaseUnit: data.costPerBaseUnit,
      mrp: data.mrp,
      sellingPrice: data.sellingPrice,
      status: data.status || 'ACTIVE',
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  });
}

async function updateProductBatch(batchId, storeId, data) {
  const existing = await prisma.productBatch.findFirst({
    where: {
      id: batchId,
      storeId,
    },
  });

  if (!existing) {
    const error = new Error('Product batch not found');
    error.statusCode = 404;
    throw error;
  }

  const updateData = {};

  if (data.batchNumber !== undefined) {
    updateData.batchNumber = data.batchNumber;
  }

  if (data.manufacturingDate !== undefined) {
    updateData.manufacturingDate = data.manufacturingDate
      ? new Date(data.manufacturingDate)
      : null;
  }

  if (data.expiryDate !== undefined) {
    updateData.expiryDate = new Date(data.expiryDate);
  }

  if (data.purchasePrice !== undefined) {
    updateData.purchasePrice = data.purchasePrice;
  }

  if (data.costPerBaseUnit !== undefined) {
    updateData.costPerBaseUnit = data.costPerBaseUnit;
  }

  if (data.mrp !== undefined) {
    updateData.mrp = data.mrp;
  }

  if (data.sellingPrice !== undefined) {
    updateData.sellingPrice = data.sellingPrice;
  }

  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  return prisma.productBatch.update({
    where: {
      id: batchId,
    },
    data: updateData,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  });
}

async function deleteProductBatch(batchId, storeId) {
  const existing = await prisma.productBatch.findFirst({
    where: {
      id: batchId,
      storeId,
    },
  });

  if (!existing) {
    const error = new Error('Product batch not found');
    error.statusCode = 404;
    throw error;
  }

  await prisma.productBatch.delete({
    where: {
      id: batchId,
    },
  });

  return {
    message: 'Product batch deleted successfully',
  };
}

module.exports = {
  getProductBatches,
  getProductBatch,
  createProductBatch,
  updateProductBatch,
  deleteProductBatch,
};
