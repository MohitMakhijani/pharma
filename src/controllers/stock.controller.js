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
};
