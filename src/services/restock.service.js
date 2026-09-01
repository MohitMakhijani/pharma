const prisma = require('../config/prisma');

async function getRestockSuggestions(storeId, filters = {}) {
  const { search, supplierId, lowStockOnly = true } = filters;

  // 1. Fetch all active products with their stocks, packaging, and supplier associations
  const products = await prisma.product.findMany({
    where: {
      storeId,
      status: 'ACTIVE',
      ...(search && search.trim()
        ? {
            OR: [
              { name: { contains: search.trim(), mode: 'insensitive' } },
              { genericName: { contains: search.trim(), mode: 'insensitive' } },
              { sku: { contains: search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      baseUnit: true,
      category: true,
      packaging: {
        include: {
          unit: true,
        },
      },
      suppliers: {
        include: {
          supplier: true,
        },
      },
      stocks: {
        include: {
          batch: true,
        },
      },
      batches: {
        where: {
          status: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  });

  const restockList = [];

  for (const product of products) {
    const currentStock = (product.stocks || []).reduce(
      (sum, s) => sum + Number(s.quantity || 0),
      0
    );
    const minStock = Number(product.minimumStock || 0);
    const reorderThreshold = Number(product.reorderLevel || minStock || 10);

    const isLowStock = currentStock <= reorderThreshold;
    if (lowStockOnly && !isLowStock) continue;

    // Determine preferred or default supplier
    const preferredSupplierLink = product.suppliers.find((s) => s.isPreferred) || product.suppliers[0];
    if (supplierId && supplierId !== 'ALL' && preferredSupplierLink?.supplierId !== supplierId) {
      continue;
    }

    const latestBatch = product.batches[0];
    const defaultPackage = product.packaging.find((p) => p.isDefault) || product.packaging[0];
    const conversion = Number(defaultPackage?.conversionToBase || 1);

    const suggestedBaseUnits = Math.max(0, (reorderThreshold * 2) - currentStock) || 20;
    const suggestedPackQty = Math.ceil(suggestedBaseUnits / conversion);
    const estUnitPrice = Number(preferredSupplierLink?.purchasePrice || latestBatch?.purchasePrice || 0);
    const estTotalCost = suggestedPackQty * estUnitPrice;

    restockList.push({
      productId: product.id,
      name: product.name,
      genericName: product.genericName || '—',
      sku: product.sku,
      currentStock,
      minimumStock: minStock,
      reorderLevel: reorderThreshold,
      baseUnit: product.baseUnit?.name || 'Units',
      suggestedPackQty,
      packageName: defaultPackage?.name || 'Pack',
      packagingId: defaultPackage?.id || null,
      conversionToBase: conversion,
      preferredSupplier: preferredSupplierLink
        ? {
            id: preferredSupplierLink.supplier.id,
            name: preferredSupplierLink.supplier.name,
            phone: preferredSupplierLink.supplier.phone || '—',
          }
        : null,
      estUnitPrice,
      estTotalCost,
      status: currentStock === 0 ? 'OUT_OF_STOCK' : currentStock <= minStock ? 'CRITICAL' : 'LOW',
    });
  }

  // Sort by urgency: OUT_OF_STOCK first, then CRITICAL, then LOW
  const priorityMap = { OUT_OF_STOCK: 1, CRITICAL: 2, LOW: 3 };
  restockList.sort((a, b) => (priorityMap[a.status] || 99) - (priorityMap[b.status] || 99));

  return {
    summary: {
      totalRestockItems: restockList.length,
      outOfStockCount: restockList.filter((r) => r.status === 'OUT_OF_STOCK').length,
      criticalCount: restockList.filter((r) => r.status === 'CRITICAL').length,
      estTotalReorderValue: restockList.reduce((sum, r) => sum + r.estTotalCost, 0),
    },
    items: restockList,
  };
}

async function createPurchaseOrderDraft(storeId, supplierId, items = []) {
  if (!supplierId) {
    throw new Error('Supplier is required to create a purchase order');
  }

  if (!items || items.length === 0) {
    throw new Error('At least one item is required in the purchase order');
  }

  const generatedInvoiceNumber = `PO-${Date.now()}`;

  let subtotal = 0;
  for (const item of items) {
    subtotal += (Number(item.quantity || 0) * Number(item.unitPrice || 0));
  }

  return prisma.purchase.create({
    data: {
      storeId,
      supplierId,
      invoiceNumber: generatedInvoiceNumber,
      invoiceDate: new Date(),
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      subtotal,
      totalAmount: subtotal,
      notes: 'Generated via Auto-Restock Module',
      items: {
        create: items.map((it) => ({
          productId: it.productId,
          batchId: it.batchId || it.productId, // placeholder batch for PO draft
          packagingId: it.packagingId || null,
          quantity: it.quantity,
          baseQuantity: Number(it.quantity) * Number(it.conversionToBase || 1),
          unitPrice: it.unitPrice,
          totalAmount: Number(it.quantity) * Number(it.unitPrice),
        })),
      },
    },
  });
}

module.exports = {
  getRestockSuggestions,
  createPurchaseOrderDraft,
};
