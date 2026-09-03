const prisma = require('../config/prisma');

// Allowed entities for soft-delete & purge operations
const ENTITY_CONFIG = {
  drugs: {
    model: 'product',
    label: 'Drug / Medicine',
    include: {
      category: true,
      manufacturer: true,
      baseUnit: true,
      batches: true,
    },
  },
  products: {
    model: 'product',
    label: 'Drug / Medicine',
    include: {
      category: true,
      manufacturer: true,
      baseUnit: true,
      batches: true,
    },
  },
  customers: {
    model: 'customer',
    label: 'Customer',
    include: {},
  },
  suppliers: {
    model: 'supplier',
    label: 'Supplier',
    include: {},
  },
  purchases: {
    model: 'purchase',
    label: 'Purchase',
    include: {
      supplier: true,
      items: {
        include: {
          product: true,
          batch: true,
        },
      },
    },
  },
  sales: {
    model: 'sale',
    label: 'Sale',
    include: {
      customer: true,
      items: {
        include: {
          product: true,
          batch: true,
        },
      },
    },
  },
};

function normalizeEntity(entityParam) {
  const clean = String(entityParam || '').toLowerCase().replace(/-trash$/, '').trim();
  return ENTITY_CONFIG[clean] || null;
}

// GET /api/trash/:entity
async function getTrashItems(req, res) {
  try {
    const config = normalizeEntity(req.params.entity);
    if (!config) {
      return res.status(400).json({
        success: false,
        message: `Unsupported trash entity: ${req.params.entity}. Supported: drugs, customers, suppliers, purchases, sales`,
      });
    }

    const modelName = config.model;
    const items = await prisma[modelName].findMany({
      where: {
        storeId: req.user.storeId,
        isDeleted: true,
      },
      include: config.include,
      orderBy: {
        deletedAt: 'desc',
      },
    });

    return res.json({
      success: true,
      data: items,
      entity: req.params.entity,
      count: items.length,
    });
  } catch (error) {
    console.error(`Get trash error for ${req.params.entity}:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch trash items',
    });
  }
}

// POST /api/trash/:entity/:id/restore
async function restoreTrashItem(req, res) {
  try {
    const config = normalizeEntity(req.params.entity);
    if (!config) {
      return res.status(400).json({
        success: false,
        message: `Unsupported trash entity: ${req.params.entity}`,
      });
    }

    const modelName = config.model;
    const existing = await prisma[modelName].findFirst({
      where: {
        id: req.params.id,
        storeId: req.user.storeId,
        isDeleted: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `${config.label} not found in trash`,
      });
    }

    const restored = await prisma[modelName].update({
      where: {
        id: req.params.id,
      },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    return res.json({
      success: true,
      message: `${config.label} restored successfully`,
      data: restored,
    });
  } catch (error) {
    console.error(`Restore trash item error:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to restore item',
    });
  }
}

// DELETE /api/trash/:entity/:id/purge
async function purgeTrashItem(req, res) {
  try {
    const config = normalizeEntity(req.params.entity);
    if (!config) {
      return res.status(400).json({
        success: false,
        message: `Unsupported trash entity: ${req.params.entity}`,
      });
    }

    const modelName = config.model;
    const existing = await prisma[modelName].findFirst({
      where: {
        id: req.params.id,
        storeId: req.user.storeId,
        isDeleted: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `${config.label} not found in trash`,
      });
    }

    // Surgical purge handling based on relations
    if (modelName === 'product') {
      await prisma.$transaction(async (tx) => {
        await tx.stockMovement.deleteMany({ where: { productId: req.params.id } });
        await tx.stock.deleteMany({ where: { productId: req.params.id } });
        await tx.productSupplier.deleteMany({ where: { productId: req.params.id } });
        await tx.productSalt.deleteMany({ where: { productId: req.params.id } });
        await tx.productPackaging.deleteMany({ where: { productId: req.params.id } });
        await tx.productBatch.deleteMany({ where: { productId: req.params.id } });
        await tx.product.delete({ where: { id: req.params.id } });
      });
    } else if (modelName === 'customer') {
      await prisma.$transaction(async (tx) => {
        await tx.customerLedgerShare.deleteMany({ where: { customerId: req.params.id } });
        await tx.ledgerEntry.deleteMany({ where: { customerId: req.params.id } });
        await tx.payment.deleteMany({ where: { customerId: req.params.id } });
        await tx.customer.delete({ where: { id: req.params.id } });
      });
    } else if (modelName === 'supplier') {
      await prisma.$transaction(async (tx) => {
        await tx.ledgerEntry.deleteMany({ where: { supplierId: req.params.id } });
        await tx.payment.deleteMany({ where: { supplierId: req.params.id } });
        await tx.productSupplier.deleteMany({ where: { supplierId: req.params.id } });
        await tx.supplier.delete({ where: { id: req.params.id } });
      });
    } else if (modelName === 'purchase') {
      await prisma.$transaction(async (tx) => {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: req.params.id } });
        await tx.purchasePayment.deleteMany({ where: { purchaseId: req.params.id } });
        await tx.purchase.delete({ where: { id: req.params.id } });
      });
    } else if (modelName === 'sale') {
      await prisma.$transaction(async (tx) => {
        await tx.saleItem.deleteMany({ where: { saleId: req.params.id } });
        await tx.salePayment.deleteMany({ where: { saleId: req.params.id } });
        await tx.sale.delete({ where: { id: req.params.id } });
      });
    } else {
      await prisma[modelName].delete({
        where: { id: req.params.id },
      });
    }

    return res.json({
      success: true,
      message: `${config.label} permanently deleted`,
    });
  } catch (error) {
    console.error(`Purge trash item error:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to permanently delete item',
    });
  }
}

// POST /api/trash/:entity/restore-all
async function restoreAllTrash(req, res) {
  try {
    const config = normalizeEntity(req.params.entity);
    if (!config) {
      return res.status(400).json({ success: false, message: `Unsupported trash entity: ${req.params.entity}` });
    }

    const modelName = config.model;
    const result = await prisma[modelName].updateMany({
      where: {
        storeId: req.user.storeId,
        isDeleted: true,
      },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });

    return res.json({
      success: true,
      message: `Restored ${result.count} ${config.label}(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error(`Restore all trash error:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to restore all items',
    });
  }
}

// DELETE /api/trash/:entity/purge-all
async function purgeAllTrash(req, res) {
  try {
    const config = normalizeEntity(req.params.entity);
    if (!config) {
      return res.status(400).json({ success: false, message: `Unsupported trash entity: ${req.params.entity}` });
    }

    const modelName = config.model;
    const items = await prisma[modelName].findMany({
      where: {
        storeId: req.user.storeId,
        isDeleted: true,
      },
      select: { id: true },
    });

    for (const item of items) {
      req.params.id = item.id;
      // invoke individual purge for safe relational cleanup
      if (modelName === 'product') {
        await prisma.$transaction(async (tx) => {
          await tx.stockMovement.deleteMany({ where: { productId: item.id } });
          await tx.stock.deleteMany({ where: { productId: item.id } });
          await tx.productSupplier.deleteMany({ where: { productId: item.id } });
          await tx.productSalt.deleteMany({ where: { productId: item.id } });
          await tx.productPackaging.deleteMany({ where: { productId: item.id } });
          await tx.productBatch.deleteMany({ where: { productId: item.id } });
          await tx.product.delete({ where: { id: item.id } });
        });
      } else if (modelName === 'customer') {
        await prisma.$transaction(async (tx) => {
          await tx.customerLedgerShare.deleteMany({ where: { customerId: item.id } });
          await tx.ledgerEntry.deleteMany({ where: { customerId: item.id } });
          await tx.payment.deleteMany({ where: { customerId: item.id } });
          await tx.customer.delete({ where: { id: item.id } });
        });
      } else if (modelName === 'supplier') {
        await prisma.$transaction(async (tx) => {
          await tx.ledgerEntry.deleteMany({ where: { supplierId: item.id } });
          await tx.payment.deleteMany({ where: { supplierId: item.id } });
          await tx.productSupplier.deleteMany({ where: { supplierId: item.id } });
          await tx.supplier.delete({ where: { id: item.id } });
        });
      } else if (modelName === 'purchase') {
        await prisma.$transaction(async (tx) => {
          await tx.purchaseItem.deleteMany({ where: { purchaseId: item.id } });
          await tx.purchasePayment.deleteMany({ where: { purchaseId: item.id } });
          await tx.purchase.delete({ where: { id: item.id } });
        });
      } else if (modelName === 'sale') {
        await prisma.$transaction(async (tx) => {
          await tx.saleItem.deleteMany({ where: { saleId: item.id } });
          await tx.salePayment.deleteMany({ where: { saleId: item.id } });
          await tx.sale.delete({ where: { id: item.id } });
        });
      }
    }

    return res.json({
      success: true,
      message: `Permanently purged ${items.length} ${config.label}(s)`,
      count: items.length,
    });
  } catch (error) {
    console.error(`Purge all trash error:`, error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to purge all trash items',
    });
  }
}

module.exports = {
  getTrashItems,
  restoreTrashItem,
  purgeTrashItem,
  restoreAllTrash,
  purgeAllTrash,
};
