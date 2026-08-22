const prisma = require('../config/prisma');

async function getProductSuppliers(productId, storeId) {
  return prisma.productSupplier.findMany({
    where: {
      productId,
      product: {
        storeId,
      },
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          contactPerson: true,
          phone: true,
          email: true,
          gstin: true,
          status: true,
        },
      },
      productBatch: {
        select: {
          id: true,
          batchNumber: true,
          expiryDate: true,
          purchasePrice: true,
          mrp: true,
          sellingPrice: true,
          status: true,
        },
      },
    },
    orderBy: [
      { isPreferred: 'desc' },
      { createdAt: 'desc' },
    ],
  });
}

async function addProductSupplier(productId, storeId, data) {
  const {
    supplierId,
    supplierSku,
    purchasePrice,
    minimumOrderQty,
    leadTimeDays,
    isPreferred = false,
    notes,
  } = data;

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

  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      storeId,
    },
  });

  if (!supplier) {
    const error = new Error('Supplier not found');
    error.statusCode = 404;
    throw error;
  }

  const existing = await prisma.productSupplier.findUnique({
    where: {
      productId_supplierId: {
        productId,
        supplierId,
      },
    },
  });

  if (existing) {
    const error = new Error('Supplier is already linked to this product');
    error.statusCode = 409;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    if (isPreferred) {
      await tx.productSupplier.updateMany({
        where: {
          productId,
          isPreferred: true,
        },
        data: {
          isPreferred: false,
        },
      });
    }

    return tx.productSupplier.create({
      data: {
        productId,
        supplierId,
        supplierSku: supplierSku || null,
        purchasePrice: purchasePrice ?? null,
        minimumOrderQty: minimumOrderQty ?? null,
        leadTimeDays: leadTimeDays ?? null,
        isPreferred,
        notes: notes || null,
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
            phone: true,
            email: true,
            gstin: true,
            status: true,
          },
        },
      },
    });
  });
}

async function updateProductSupplier(
  productId,
  supplierId,
  storeId,
  data
) {
  const existing = await prisma.productSupplier.findFirst({
    where: {
      productId,
      supplierId,
      product: {
        storeId,
      },
    },
  });

  if (!existing) {
    const error = new Error('Product supplier relationship not found');
    error.statusCode = 404;
    throw error;
  }

  const {
    supplierSku,
    purchasePrice,
    minimumOrderQty,
    leadTimeDays,
    isPreferred,
    isActive,
    notes,
  } = data;

  return prisma.$transaction(async (tx) => {
    if (isPreferred === true) {
      await tx.productSupplier.updateMany({
        where: {
          productId,
          isPreferred: true,
          NOT: {
            id: existing.id,
          },
        },
        data: {
          isPreferred: false,
        },
      });
    }

    return tx.productSupplier.update({
      where: {
        id: existing.id,
      },
      data: {
        ...(supplierSku !== undefined && {
          supplierSku: supplierSku || null,
        }),
        ...(purchasePrice !== undefined && {
          purchasePrice,
        }),
        ...(minimumOrderQty !== undefined && {
          minimumOrderQty,
        }),
        ...(leadTimeDays !== undefined && {
          leadTimeDays,
        }),
        ...(isPreferred !== undefined && {
          isPreferred,
        }),
        ...(isActive !== undefined && {
          isActive,
        }),
        ...(notes !== undefined && {
          notes: notes || null,
        }),
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
            phone: true,
            email: true,
            gstin: true,
            status: true,
          },
        },
      },
    });
  });
}

async function removeProductSupplier(
  productId,
  supplierId,
  storeId
) {
  const existing = await prisma.productSupplier.findFirst({
    where: {
      productId,
      supplierId,
      product: {
        storeId,
      },
    },
  });

  if (!existing) {
    const error = new Error('Product supplier relationship not found');
    error.statusCode = 404;
    throw error;
  }

  await prisma.productSupplier.delete({
    where: {
      id: existing.id,
    },
  });

  return {
    message: 'Supplier removed from product successfully',
  };
}

async function getSupplierProducts(supplierId, storeId) {
  const supplier = await prisma.supplier.findFirst({
    where: {
      id: supplierId,
      storeId,
    },
  });

  if (!supplier) {
    const error = new Error('Supplier not found');
    error.statusCode = 404;
    throw error;
  }

  return prisma.productSupplier.findMany({
    where: {
      supplierId,
      product: {
        storeId,
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          genericName: true,
          brandName: true,
          sku: true,
          barcode: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

module.exports = {
  getProductSuppliers,
  addProductSupplier,
  updateProductSupplier,
  removeProductSupplier,
  getSupplierProducts,
};
