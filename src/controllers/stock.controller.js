const stockService = require('../services/stock.service');

async function getProductStock(req, res, next) {
  try {
    const data = await stockService.getProductStock(
      req.params.productId,
      req.user.storeId
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getBatchStock(req, res, next) {
  try {
    const data = await stockService.getBatchStock(
      req.params.batchId,
      req.user.storeId
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found',
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function addStock(req, res, next) {
  try {
    const data = await stockService.addStock(
      req.params.batchId,
      req.user.storeId,
      req.user.userId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'Stock added successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function adjustStock(req, res, next) {
  try {
    const data = await stockService.adjustStock(
      req.params.batchId,
      req.user.storeId,
      req.user.userId,
      req.body
    );

    res.json({
      success: true,
      message: 'Stock adjusted successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getProductMovements(req, res, next) {
  try {
    const data = await stockService.getProductMovements(
      req.params.productId,
      req.user.storeId
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getBatchMovements(req, res, next) {
  try {
    const storeId = req.query.storeId || req.user.storeId;

    const data = await stockService.getBatchMovements(
      req.params.batchId,
      storeId
    );

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function exportStock(req, res, next) {
  try {
    const rows = await stockService.exportStock(req.user.storeId, req.query);
    const headers = ['Drug / Generic Name', 'SKU', 'Batch Number', 'HSN Code', 'Schedule', 'Stock', 'Reserved', 'Available', 'Cost', 'MRP', 'Expiry Date', 'Supplier'];
    const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csvRows = rows.map((row) => [row.product.name, row.product.sku, row.batch.batchNumber, row.product.hsnCode, row.product.scheduling, row.asOfQuantity, row.reservedQuantity, row.asOfQuantity - Number(row.reservedQuantity), row.batch.purchasePrice, row.batch.mrp, row.batch.expiryDate.toISOString().slice(0, 10), row.product.suppliers[0]?.supplier?.name].map(csvValue).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stock-audit-${req.query.asOf || new Date().toISOString().slice(0, 10)}.csv"`);
    res.send([headers.map(csvValue).join(','), ...csvRows].join('\n'));
  } catch (error) { next(error); }
}
async function createInventoryAudit(req, res, next) {
  try { res.status(201).json({ success: true, data: await stockService.createInventoryAudit(req.user.storeId, req.user.userId || req.user.sub, req.body) }); } catch (error) { next(error); }
}
async function getInventoryAudit(req, res, next) {
  try { const data = await stockService.getInventoryAudit(req.params.auditId, req.user.storeId); if (!data) return res.status(404).json({ success: false, message: 'Audit not found' }); res.json({ success: true, data }); } catch (error) { next(error); }
}
async function completeInventoryAudit(req, res, next) {
  try { res.json({ success: true, data: await stockService.completeInventoryAudit(req.params.auditId, req.user.storeId, req.user.userId || req.user.sub, req.body.items) }); } catch (error) { next(error); }
}
async function importStock(req, res, next) {
  try { res.json({ success: true, data: await stockService.importStock(req.user.storeId, req.user.userId || req.user.sub, req.body.rows) }); } catch (error) { next(error); }
}


async function reserveStock(req, res, next) {
  try {
    const data = await stockService.reserveStock(
      req.params.batchId,
      req.user.storeId,
      req.user.userId,
      req.body
    );

    res.json({
      success: true,
      message: 'Stock reserved successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function releaseStock(req, res, next) {
  try {
    const data = await stockService.releaseStock(
      req.params.batchId,
      req.user.storeId,
      req.user.userId,
      req.body
    );

    res.json({
      success: true,
      message: 'Stock reservation released successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}


async function sellStock(req, res, next) {
  try {
    const data = await stockService.sellStock(
      req.params.batchId,
      req.user.storeId,
      req.body,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'Stock sold successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}


async function confirmSale(req, res, next) {
  try {
    const data = await stockService.confirmSale(
      req.params.batchId,
      req.user.storeId,
      req.body,
      req.user.userId
    );

    res.json({
      success: true,
      message: 'Reserved stock sale confirmed successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}


async function salesReturn(req, res, next) {
  try {
    const data = await stockService.salesReturn(
      req.params.batchId,
      req.user.storeId,
      req.user.userId || req.user.sub,
      req.body
    );

    res.json({
      success: true,
      message: 'Sales return processed successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}


async function purchaseReturn(req, res, next) {
  try {
    const data = await stockService.purchaseReturn(
      req.params.batchId,
      req.user.storeId,
      req.user.userId || req.user.sub,
      req.body
    );

    res.json({
      success: true,
      message: 'Purchase return processed successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}


async function damageStock(req, res, next) {
  try {
    const data = await stockService.damageStock(
      req.params.batchId,
      req.user.storeId,
      req.user.userId || req.user.sub,
      req.body
    );

    res.json({
      success: true,
      message: 'Damaged stock processed successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}


async function expireStock(req, res, next) {
  try {
    const data = await stockService.expireStock(
      req.params.batchId,
      req.user.storeId,
      req.user.userId || req.user.sub,
      req.body
    );

    res.json({
      success: true,
      message: 'Expired stock processed successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}


async function transferStock(req, res, next) {
  try {
    const data = await stockService.transferStock(
      req.params.batchId,
      req.user.storeId,
      req.user.userId || req.user.sub,
      req.body
    );

    res.json({
      success: true,
      message: 'Stock transferred successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProductStock,
  getBatchStock,
  addStock,
  adjustStock,
  reserveStock,
  releaseStock,
  sellStock,
  salesReturn,
  purchaseReturn,
  damageStock,
  expireStock,
  transferStock,
  confirmSale,
  getProductMovements,
  getBatchMovements,
  exportStock,
  createInventoryAudit,
  getInventoryAudit,
  completeInventoryAudit,
  importStock,
};
