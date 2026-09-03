const prisma = require('../config/prisma');

async function getProducts(storeId) {
  return prisma.product.findMany({
    where: { storeId, isDeleted: false },
    include: {
      category: true,
      manufacturer: true,
      baseUnit: true,
      strengthUnit: true,
      packaging: {
        where: { isDefault: true },
        take: 1,
      },
      batches: {
        where: { storeId },
        orderBy: { expiryDate: 'asc' },
        include: {
          stocks: {
            where: { storeId },
            select: { quantity: true },
          },
        },
      },
      suppliers: {
        where: { isActive: true },
        include: { supplier: true },
      },
      salts: {
        include: { salt: true },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });
}

async function getProduct(productId, storeId) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      storeId,
      isDeleted: false,
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
      salts: {
        include: { salt: true },
      },
    },
  });

  if (!product) return null;

  const relatedProducts = await prisma.product.findMany({
    where: {
      storeId,
      isDeleted: false,
      id: { not: product.id },
      salts: { some: { saltId: { in: product.salts.map((mapping) => mapping.saltId) } } },
    },
    select: { id: true, name: true, genericName: true, brandName: true, dosageForm: true, sku: true },
    orderBy: { name: 'asc' },
  });

  return { ...product, relatedProducts };
}

async function createProduct(storeId, data) {
  const [category, manufacturer, strengthUnit] = await Promise.all([
    data.categoryId
      ? prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } })
      : null,
    data.manufacturerId
      ? prisma.manufacturer.findUnique({ where: { id: data.manufacturerId }, select: { id: true } })
      : null,
    data.strengthUnitId
      ? prisma.unit.findUnique({ where: { id: data.strengthUnitId }, select: { id: true } })
      : null,
  ]);

  return prisma.product.create({
    data: {
      storeId,
      name: data.name,
      genericName: data.genericName || null,
      brandName: data.brandName || null,
      sku: data.sku,
      barcode: data.barcode || null,
      rack: data.rack || null,
      scheduling: data.scheduling || null,
      prescriptionOnly: data.prescriptionOnly ?? false,
      dosageForm: data.dosageForm || null,
      strength: data.strength ?? null,
      strengthUnitId: strengthUnit?.id || null,
      categoryId: category?.id || null,
      manufacturerId: manufacturer?.id || null,
      description: data.description || null,
      gstPercent: data.gstPercent ?? 0,
      baseUnitId: data.baseUnitId,
      minimumStock: data.minimumStock ?? 0,
      reorderLevel: data.reorderLevel ?? 0,
    },
  });
}

async function updateProduct(productId, storeId, data) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.product.update({
    where: { id: existing.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.barcode !== undefined && { barcode: data.barcode || null }),
      ...(data.hsnCode !== undefined && { hsnCode: data.hsnCode || null }),
      ...(data.rack !== undefined && { rack: data.rack || null }),
      ...(data.scheduling !== undefined && { scheduling: data.scheduling || null }),
      ...(data.prescriptionOnly !== undefined && { prescriptionOnly: Boolean(data.prescriptionOnly) }),
      ...(data.dosageForm !== undefined && { dosageForm: data.dosageForm || null }),
      ...(data.reorderLevel !== undefined && { reorderLevel: data.reorderLevel }),
    },
  });
}

async function getProductPurchaseHistory(productId, storeId) {
  return prisma.purchaseItem.findMany({
    where: {
      productId,
      purchase: { storeId },
    },
    include: {
      purchase: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          status: true,
          supplier: { select: { id: true, name: true, phone: true, gstin: true, city: true } },
        },
      },
      batch: { select: { batchNumber: true, expiryDate: true } },
    },
    orderBy: { purchase: { invoiceDate: 'desc' } },
  });
}

async function getSalts(search = '') {
  return prisma.salt.findMany({
    where: search.trim() ? { name: { contains: search.trim(), mode: 'insensitive' } } : undefined,
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
    take: 30,
  });
}

async function mapProductToSalt(productId, storeId, saltId) {
  const product = await prisma.product.findFirst({ where: { id: productId, storeId }, select: { id: true } });
  if (!product) return null;

  return prisma.productSalt.upsert({
    where: { productId_saltId: { productId, saltId } },
    update: {},
    create: { productId, saltId },
    include: { salt: true },
  });
}

async function createSalt(name) {
  const normalizedName = String(name || '').trim().replace(/\s+/g, ' ');
  if (!normalizedName) return null;
  return prisma.salt.upsert({
    where: { name: normalizedName },
    update: {},
    create: { name: normalizedName },
    select: { id: true, name: true },
  });
}

async function deleteProduct(productId, storeId) {
  const existing = await prisma.product.findFirst({
    where: { id: productId, storeId, isDeleted: false },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.product.update({
    where: { id: existing.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });
}

module.exports = {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductPurchaseHistory,
  getSalts,
  mapProductToSalt,
  createSalt,
};
