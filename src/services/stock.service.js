const crypto = require('crypto');
const prisma = require('../config/prisma');

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getProductStock(productId, storeId) {
  return prisma.stock.findMany({
    where: {
      productId,
      storeId,
    },
    include: {
      batch: {
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
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          baseUnit: true,
        },
      },
    },
    orderBy: {
      batch: {
        expiryDate: 'asc',
      },
    },
  });
}

async function getBatchStock(batchId, storeId) {
  return prisma.stock.findFirst({
    where: {
      batchId,
      storeId,
    },
    include: {
      batch: {
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
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          baseUnit: true,
        },
      },
      movements: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      },
    },
  });
}

async function addStock(batchId, storeId, createdById, data) {
  const quantity = Number(data.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createError('Quantity must be greater than 0');
  }

  const batch = await prisma.productBatch.findFirst({
    where: {
      id: batchId,
      storeId,
    },
  });

  if (!batch) {
    throw createError('Product batch not found', 404);
  }

  return prisma.$transaction(async (tx) => {
    let stock = await tx.stock.findUnique({
      where: {
        storeId_productId_batchId: {
          storeId,
          productId: batch.productId,
          batchId,
        },
      },
    });

    if (!stock) {
      stock = await tx.stock.create({
        data: {
          storeId,
          productId: batch.productId,
          batchId,
          quantity: 0,
          reservedQuantity: 0,
        },
      });
    }

    const quantityBefore = Number(stock.quantity);
    const quantityAfter = quantityBefore + quantity;

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        quantity: quantityAfter,
      },
    });

    await tx.stockMovement.create({
      data: {
        storeId,
        productId: batch.productId,
        batchId,
        stockId: stock.id,
        type: data.type || 'OPENING_STOCK',
        referenceType: data.referenceType || 'MANUAL',
        quantity,
        quantityBefore,
        quantityAfter,
        unitCost:
          data.unitCost !== undefined
            ? data.unitCost
            : batch.costPerBaseUnit,
        referenceId: data.referenceId || null,
        reason: data.reason || null,
        notes: data.notes || null,
        createdById: createdById || null,
      },
    });

    return updatedStock;
  });
}

async function adjustStock(batchId, storeId, createdById, data) {
  const quantity = Number(data.quantity);

  if (!Number.isFinite(quantity) || quantity === 0) {
    throw createError('Quantity cannot be zero');
  }

  const batch = await prisma.productBatch.findFirst({
    where: {
      id: batchId,
      storeId,
    },
  });

  if (!batch) {
    throw createError('Product batch not found', 404);
  }

  return prisma.$transaction(async (tx) => {
    let stock = await tx.stock.findUnique({
      where: {
        storeId_productId_batchId: {
          storeId,
          productId: batch.productId,
          batchId,
        },
      },
    });

    if (!stock) {
      stock = await tx.stock.create({
        data: {
          storeId,
          productId: batch.productId,
          batchId,
          quantity: 0,
          reservedQuantity: 0,
        },
      });
    }

    const quantityBefore = Number(stock.quantity);
    const quantityAfter = quantityBefore + quantity;

    if (quantityAfter < 0) {
      throw createError('Insufficient stock');
    }

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        quantity: quantityAfter,
      },
    });

    await tx.stockMovement.create({
      data: {
        storeId,
        productId: batch.productId,
        batchId,
        stockId: stock.id,
        type:
          quantity > 0
            ? 'ADJUSTMENT_IN'
            : 'ADJUSTMENT_OUT',
        referenceType: 'ADJUSTMENT',
        quantity,
        quantityBefore,
        quantityAfter,
        unitCost:
          data.unitCost !== undefined
            ? data.unitCost
            : batch.costPerBaseUnit,
        referenceId: data.referenceId || null,
        reason: data.reason || null,
        notes: data.notes || null,
        createdById: createdById || null,
      },
    });

    return updatedStock;
  });
}

async function getProductMovements(productId, storeId) {
  return prisma.stockMovement.findMany({
    where: {
      productId,
      storeId,
    },
    include: {
      stock: true,
      batch: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

async function getBatchMovements(batchId, storeId) {
  return prisma.stockMovement.findMany({
    where: {
      batchId,
      storeId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

async function exportStock(storeId, options = {}) {
  const asOf = options.asOf ? new Date(`${options.asOf}T23:59:59.999`) : new Date();
  const stockCondition = options.stockCondition || 'all';
  const expiryCondition = options.expiryCondition || 'all';
  const groupBatchWise = options.groupBatchWise !== false;
  if (Number.isNaN(asOf.getTime())) throw createError('Invalid reporting date');
  const stocks = await prisma.stock.findMany({
    where: { storeId },
    include: {
      batch: { select: { batchNumber: true, expiryDate: true, purchasePrice: true, sellingPrice: true, mrp: true } },
      product: { select: { name: true, sku: true, hsnCode: true, rack: true, reorderLevel: true, scheduling: true, suppliers: { where: { isPreferred: true }, include: { supplier: { select: { name: true } } }, take: 1 } } },
      movements: { where: { createdAt: { lte: asOf } }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { product: { name: 'asc' } },
  });
  const rows = stocks.map((stock) => ({ ...stock, asOfQuantity: stock.movements[0] ? Number(stock.movements[0].quantityAfter) : 0 })).filter((stock) => {
    if (stockCondition === 'inStock' && stock.asOfQuantity <= 0) return false;
    if (stockCondition === 'outOfStock' && stock.asOfQuantity > 0) return false;
    const expiry = new Date(stock.batch.expiryDate);
    const months = (expiry.getFullYear() - asOf.getFullYear()) * 12 + expiry.getMonth() - asOf.getMonth();
    if (expiryCondition === 'expired' && expiry >= asOf) return false;
    if (expiryCondition !== 'all' && expiryCondition !== 'expired' && (expiry < asOf || months > Number(expiryCondition))) return false;
    return true;
  });
  if (!groupBatchWise) {
    const grouped = new Map();
    rows.forEach((row) => {
      const key = row.productId;
      const existing = grouped.get(key);
      if (existing) { existing.asOfQuantity += row.asOfQuantity; existing.reservedQuantity += Number(row.reservedQuantity); }
      else grouped.set(key, { ...row, batch: { ...row.batch, batchNumber: 'Multiple' } });
    });
    return [...grouped.values()];
  }
  return rows;
}

async function createInventoryAudit(storeId, createdById, { auditDate, condition = 'all' }) {
  const stocks = await prisma.stock.findMany({ where: { storeId }, include: { batch: true } });
  const filtered = stocks.filter((stock) => {
    const quantity = Number(stock.quantity);
    if (condition === 'inStock') return quantity > 0;
    if (condition === 'outOfStock') return quantity <= 0;
    if (condition === 'expired') return stock.batch.expiryDate < new Date();
    return true;
  });
  return prisma.inventoryAudit.create({
    data: { storeId, createdById: createdById || null, auditDate: auditDate ? new Date(auditDate) : new Date(), condition, items: { create: filtered.map((stock) => ({ productId: stock.productId, batchId: stock.batchId, expectedQty: stock.quantity })) } },
    include: { items: true },
  });
}

async function getInventoryAudit(id, storeId) {
  return prisma.inventoryAudit.findFirst({ where: { id, storeId }, include: { items: { include: { product: { select: { name: true, sku: true } }, batch: { select: { batchNumber: true } } } } } });
}

async function completeInventoryAudit(id, storeId, createdById, items) {
  const audit = await prisma.inventoryAudit.findFirst({ where: { id, storeId, status: 'OPEN' }, include: { items: true } });
  if (!audit) throw createError('Open stock audit not found', 404);
  return prisma.$transaction(async (tx) => {
    for (const item of audit.items) {
      const counted = Number(items?.find((value) => value.id === item.id)?.countedQty);
      if (!Number.isFinite(counted) || counted < 0) throw createError('Every counted quantity must be a non-negative number');
      const stock = await tx.stock.findUnique({ where: { storeId_productId_batchId: { storeId, productId: item.productId, batchId: item.batchId } } });
      if (!stock) continue;
      const variance = counted - Number(stock.quantity);
      if (variance !== 0) await tx.stock.update({ where: { id: stock.id }, data: { quantity: counted } });
      if (variance !== 0) await tx.stockMovement.create({ data: { storeId, productId: item.productId, batchId: item.batchId, stockId: stock.id, type: variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', referenceType: 'ADJUSTMENT', quantity: variance, quantityBefore: stock.quantity, quantityAfter: counted, referenceId: audit.id, reason: 'Stock audit', createdById: createdById || null } });
      await tx.inventoryAuditItem.update({ where: { id: item.id }, data: { countedQty: counted, variance } });
    }
    return tx.inventoryAudit.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() }, include: { items: true } });
  });
}

async function importStock(storeId, createdById, rows) {
  if (!Array.isArray(rows) || !rows.length) throw createError('Import rows are required');
  return prisma.$transaction(async (tx) => {
    let imported = 0;
    for (const row of rows) {
      const product = await tx.product.findFirst({ where: { storeId, OR: [{ sku: String(row.sku || '') }, { barcode: String(row.barcode || '') }] } });
      if (!product) throw createError(`Product not found for SKU/barcode: ${row.sku || row.barcode}`);
      const batch = await tx.productBatch.findFirst({ where: { storeId, productId: product.id, batchNumber: String(row.batchNumber || '') } });
      if (!batch) throw createError(`Batch not found: ${row.batchNumber}`);
      const quantity = Number(row.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) throw createError(`Invalid quantity for ${row.sku}`);
      const stock = await tx.stock.upsert({ where: { storeId_productId_batchId: { storeId, productId: product.id, batchId: batch.id } }, create: { storeId, productId: product.id, batchId: batch.id, quantity, reservedQuantity: 0 }, update: { quantity: { increment: quantity } } });
      await tx.stockMovement.create({ data: { storeId, productId: product.id, batchId: batch.id, stockId: stock.id, type: 'OPENING_STOCK', referenceType: 'MANUAL', quantity, quantityBefore: Number(stock.quantity) - quantity, quantityAfter: stock.quantity, reason: 'Stock import', createdById: createdById || null } });
      imported += 1;
    }
    return { imported };
  });
}


async function reserveStock(batchId, storeId, createdById, data) {
  const quantity = Number(data.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createError('Quantity must be greater than 0');
  }

  const batch = await prisma.productBatch.findFirst({
    where: {
      id: batchId,
      storeId,
    },
  });

  if (!batch) {
    throw createError('Product batch not found', 404);
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findUnique({
      where: {
        storeId_productId_batchId: {
          storeId,
          productId: batch.productId,
          batchId,
        },
      },
    });

    if (!stock) {
      throw createError('Stock not found', 404);
    }

    const currentQuantity = Number(stock.quantity);
    const currentReserved = Number(stock.reservedQuantity);
    const availableQuantity = currentQuantity - currentReserved;

    if (quantity > availableQuantity) {
      throw createError(
        `Insufficient available stock. Available: ${availableQuantity}`
      );
    }

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        reservedQuantity: currentReserved + quantity,
      },
    });

    return updatedStock;
  });
}

async function releaseStock(batchId, storeId, createdById, data) {
  const quantity = Number(data.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw createError('Quantity must be greater than 0');
  }

  const batch = await prisma.productBatch.findFirst({
    where: {
      id: batchId,
      storeId,
    },
  });

  if (!batch) {
    throw createError('Product batch not found', 404);
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findUnique({
      where: {
        storeId_productId_batchId: {
          storeId,
          productId: batch.productId,
          batchId,
        },
      },
    });

    if (!stock) {
      throw createError('Stock not found', 404);
    }

    const currentReserved = Number(stock.reservedQuantity);

    if (quantity > currentReserved) {
      throw createError(
        `Cannot release ${quantity}. Reserved stock: ${currentReserved}`
      );
    }

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        reservedQuantity: currentReserved - quantity,
      },
    });

    return updatedStock;
  });
}


async function sellStock(batchId, storeId, data, createdById) {
  const quantity = Number(data.quantity);

  if (!quantity || quantity <= 0) {
    const error = new Error('Quantity must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findFirst({
      where: {
        batchId,
        storeId,
      },
    });

    if (!stock) {
      const error = new Error('Stock not found');
      error.statusCode = 404;
      throw error;
    }

    const currentQuantity = Number(stock.quantity);
    const currentReserved = Number(stock.reservedQuantity);
    const availableQuantity = currentQuantity - currentReserved;

    if (quantity > availableQuantity) {
      const error = new Error(
        `Insufficient available stock. Available: ${availableQuantity}`
      );
      error.statusCode = 400;
      throw error;
    }

    const quantityAfter = currentQuantity - quantity;

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        quantity: quantityAfter,
      },
    });

    await tx.stockMovement.create({
      data: {
        storeId,
        productId: stock.productId,
        batchId,
        stockId: stock.id,
        type: 'SALE',
        referenceType: 'SALE',
        quantity: -quantity,
        quantityBefore: currentQuantity,
        quantityAfter,
        unitCost: data.unitCost ?? null,
        referenceId: data.referenceId ?? null,
        reason: data.reason || 'Sale',
        notes: data.notes || null,
        createdById: createdById || null,
      },
    });

    return updatedStock;
  });
}


async function confirmSale(batchId, storeId, data, createdById) {
  const quantity = Number(data.quantity);

  if (!quantity || quantity <= 0) {
    const error = new Error('Quantity must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findFirst({
      where: {
        batchId,
        storeId,
      },
    });

    if (!stock) {
      const error = new Error('Stock not found');
      error.statusCode = 404;
      throw error;
    }

    const currentQuantity = Number(stock.quantity);
    const currentReserved = Number(stock.reservedQuantity);

    if (quantity > currentReserved) {
      const error = new Error(
        `Insufficient reserved stock. Reserved: ${currentReserved}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (quantity > currentQuantity) {
      const error = new Error(
        `Insufficient physical stock. Stock: ${currentQuantity}`
      );
      error.statusCode = 400;
      throw error;
    }

    const quantityAfter = currentQuantity - quantity;
    const reservedAfter = currentReserved - quantity;

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        quantity: quantityAfter,
        reservedQuantity: reservedAfter,
      },
    });

    await tx.stockMovement.create({
      data: {
        storeId,
        productId: stock.productId,
        batchId,
        stockId: stock.id,
        type: 'SALE',
        referenceType: 'SALE',
        quantity: -quantity,
        quantityBefore: currentQuantity,
        quantityAfter,
        unitCost: data.unitCost ?? null,
        referenceId: data.referenceId ?? null,
        reason: data.reason || 'Confirmed sale',
        notes: data.notes || null,
        createdById: createdById || null,
      },
    });

    return updatedStock;
  });
}

async function salesReturn(batchId, storeId, createdById, data) {
  const quantity = Number(data.quantity);

  if (!quantity || quantity <= 0) {
    const error = new Error('Quantity must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findFirst({
      where: {
        batchId,
        storeId,
      },
    });

    if (!stock) {
      const error = new Error('Stock not found');
      error.statusCode = 404;
      throw error;
    }

    const currentQuantity = Number(stock.quantity);
    const quantityAfter = currentQuantity + quantity;

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        quantity: quantityAfter,
      },
    });

    await tx.stockMovement.create({
      data: {
        storeId,
        productId: stock.productId,
        batchId,
        stockId: stock.id,
        type: 'SALES_RETURN',
        referenceType: 'SALES_RETURN',
        quantity,
        quantityBefore: currentQuantity,
        quantityAfter,
        unitCost: data.unitCost ?? null,
        referenceId: data.referenceId ?? null,
        reason: data.reason || 'Sales return',
        notes: data.notes || null,
        createdById: createdById || null,
      },
    });

    return updatedStock;
  });
}


async function purchaseReturn(batchId, storeId, createdById, data) {
  const quantity = Number(data.quantity);

  if (!quantity || quantity <= 0) {
    const error = new Error('Quantity must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findFirst({
      where: {
        batchId,
        storeId,
      },
    });

    if (!stock) {
      const error = new Error('Stock not found');
      error.statusCode = 404;
      throw error;
    }

    const currentQuantity = Number(stock.quantity);
    const currentReserved = Number(stock.reservedQuantity);

    const availableQuantity = currentQuantity - currentReserved;

    if (quantity > availableQuantity) {
      const error = new Error(
        `Insufficient available stock. Available: ${availableQuantity}`
      );
      error.statusCode = 400;
      throw error;
    }

    const quantityAfter = currentQuantity - quantity;

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        quantity: quantityAfter,
      },
    });

    await tx.stockMovement.create({
      data: {
        storeId,
        productId: stock.productId,
        batchId,
        stockId: stock.id,
        type: 'PURCHASE_RETURN',
        referenceType: 'PURCHASE_RETURN',
        quantity: -quantity,
        quantityBefore: currentQuantity,
        quantityAfter,
        unitCost: data.unitCost ?? null,
        referenceId: data.referenceId ?? null,
        reason: data.reason || 'Purchase return',
        notes: data.notes || null,
        createdById: createdById || null,
      },
    });

    return updatedStock;
  });
}


async function damageStock(batchId, storeId, createdById, data) {
  const quantity = Number(data.quantity);

  if (!quantity || quantity <= 0) {
    const error = new Error('Quantity must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findFirst({
      where: {
        batchId,
        storeId,
      },
    });

    if (!stock) {
      const error = new Error('Stock not found');
      error.statusCode = 404;
      throw error;
    }

    const currentQuantity = Number(stock.quantity);
    const currentReserved = Number(stock.reservedQuantity);
    const availableQuantity = currentQuantity - currentReserved;

    if (quantity > availableQuantity) {
      const error = new Error(
        `Insufficient available stock. Available: ${availableQuantity}`
      );
      error.statusCode = 400;
      throw error;
    }

    const quantityAfter = currentQuantity - quantity;

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        quantity: quantityAfter,
      },
    });

    await tx.stockMovement.create({
      data: {
        storeId,
        productId: stock.productId,
        batchId,
        stockId: stock.id,
        type: 'DAMAGE',
        referenceType: 'ADJUSTMENT',
        quantity: -quantity,
        quantityBefore: currentQuantity,
        quantityAfter,
        unitCost: data.unitCost ?? null,
        referenceId: data.referenceId ?? null,
        reason: data.reason || 'Damaged stock',
        notes: data.notes || null,
        createdById: createdById || null,
      },
    });

    return updatedStock;
  });
}


async function expireStock(batchId, storeId, createdById, data) {
  const quantity = Number(data.quantity);

  if (!quantity || quantity <= 0) {
    const error = new Error('Quantity must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findFirst({
      where: {
        batchId,
        storeId,
      },
    });

    if (!stock) {
      const error = new Error('Stock not found');
      error.statusCode = 404;
      throw error;
    }

    const currentQuantity = Number(stock.quantity);
    const currentReserved = Number(stock.reservedQuantity);

    if (quantity > currentQuantity) {
      const error = new Error(
        `Insufficient physical stock. Stock: ${currentQuantity}`
      );
      error.statusCode = 400;
      throw error;
    }

    if (currentQuantity - quantity < currentReserved) {
      const error = new Error(
        `Cannot expire reserved stock. Available: ${currentQuantity - currentReserved}`
      );
      error.statusCode = 400;
      throw error;
    }

    const quantityAfter = currentQuantity - quantity;

    const updatedStock = await tx.stock.update({
      where: {
        id: stock.id,
      },
      data: {
        quantity: quantityAfter,
      },
    });

    await tx.stockMovement.create({
      data: {
        storeId,
        productId: stock.productId,
        batchId,
        stockId: stock.id,
        type: 'EXPIRY',
        referenceType: 'ADJUSTMENT',
        quantity: -quantity,
        quantityBefore: currentQuantity,
        quantityAfter,
        unitCost: data.unitCost ?? null,
        referenceId: data.referenceId ?? null,
        reason: data.reason || 'Expired stock',
        notes: data.notes || null,
        createdById: createdById || null,
      },
    });

    return updatedStock;
  });
}


async function transferStock(batchId, fromStoreId, createdById, data) {
  const toStoreId = data.toStoreId;
  const quantity = Number(data.quantity);

  if (!toStoreId) {
    const error = new Error('Destination store is required');
    error.statusCode = 400;
    throw error;
  }

  if (toStoreId === fromStoreId) {
    const error = new Error('Source and destination stores must be different');
    error.statusCode = 400;
    throw error;
  }

  if (!quantity || quantity <= 0) {
    const error = new Error('Quantity must be greater than 0');
    error.statusCode = 400;
    throw error;
  }

    const transferId =
    data.referenceId ||
    `TRF-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

return prisma.$transaction(async (tx) => {
    const sourceStock = await tx.stock.findFirst({
      where: {
        batchId,
        storeId: fromStoreId,
      },
    });

    if (!sourceStock) {
      const error = new Error('Source stock not found');
      error.statusCode = 404;
      throw error;
    }

    const sourceQuantity = Number(sourceStock.quantity);
    const sourceReserved = Number(sourceStock.reservedQuantity);
    const availableQuantity = sourceQuantity - sourceReserved;

    if (quantity > availableQuantity) {
      const error = new Error(
        `Insufficient available stock. Available: ${availableQuantity}`
      );
      error.statusCode = 400;
      throw error;
    }

    const destinationStock = await tx.stock.findFirst({
      where: {
        batchId,
        storeId: toStoreId,
      },
    });

    const sourceQuantityAfter = sourceQuantity - quantity;

    const updatedSource = await tx.stock.update({
      where: {
        id: sourceStock.id,
      },
      data: {
        quantity: sourceQuantityAfter,
      },
    });

    let updatedDestination;

    if (destinationStock) {
      const destinationQuantity = Number(destinationStock.quantity);
      const destinationQuantityAfter =
        destinationQuantity + quantity;

      updatedDestination = await tx.stock.update({
        where: {
          id: destinationStock.id,
        },
        data: {
          quantity: destinationQuantityAfter,
        },
      });

      await tx.stockMovement.create({
        data: {
          storeId: toStoreId,
          productId: sourceStock.productId,
          batchId,
          stockId: destinationStock.id,
          type: 'TRANSFER_IN',
          referenceType: 'TRANSFER',
          quantity,
          quantityBefore: destinationQuantity,
          quantityAfter: destinationQuantityAfter,
          unitCost: data.unitCost ?? null,
          referenceId: transferId,
          reason: data.reason || 'Stock transfer',
          notes: data.notes || null,
          createdById: createdById || null,
        },
      });
    } else {
      const newStock = await tx.stock.create({
        data: {
          storeId: toStoreId,
          productId: sourceStock.productId,
          batchId,
          quantity,
          reservedQuantity: 0,
        },
      });

      updatedDestination = newStock;

      await tx.stockMovement.create({
        data: {
          storeId: toStoreId,
          productId: sourceStock.productId,
          batchId,
          stockId: newStock.id,
          type: 'TRANSFER_IN',
          referenceType: 'TRANSFER',
          quantity,
          quantityBefore: 0,
          quantityAfter: quantity,
          unitCost: data.unitCost ?? null,
          referenceId: transferId,
          reason: data.reason || 'Stock transfer',
          notes: data.notes || null,
          createdById: createdById || null,
        },
      });
    }

    await tx.stockMovement.create({
      data: {
        storeId: fromStoreId,
        productId: sourceStock.productId,
        batchId,
        stockId: sourceStock.id,
        type: 'TRANSFER_OUT',
        referenceType: 'TRANSFER',
        quantity: -quantity,
        quantityBefore: sourceQuantity,
        quantityAfter: sourceQuantityAfter,
        unitCost: data.unitCost ?? null,
        referenceId: transferId,
        reason: data.reason || 'Stock transfer',
        notes: data.notes || null,
        createdById: createdById || null,
      },
    });

    return {
      source: updatedSource,
      destination: updatedDestination,
    };
  });
}

module.exports = {
  getProductStock,
  getBatchStock,
  addStock,
  adjustStock,
  reserveStock,
  releaseStock,
  sellStock,
  confirmSale,
  salesReturn,
  purchaseReturn,
  damageStock,
  expireStock,
  transferStock,
  getProductMovements,
  getBatchMovements,
  exportStock,
  createInventoryAudit,
  getInventoryAudit,
  completeInventoryAudit,
  importStock,
};
