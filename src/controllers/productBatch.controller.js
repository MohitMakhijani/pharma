const productBatchService = require('../services/productBatch.service');

async function getProductBatches(req, res, next) {
  try {
    const data = await productBatchService.getProductBatches(
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

async function getProductBatch(req, res, next) {
  try {
    const data = await productBatchService.getProductBatch(
      req.params.batchId,
      req.user.storeId
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Product batch not found',
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

async function createProductBatch(req, res, next) {
  try {
    const data = await productBatchService.createProductBatch(
      req.user.storeId,
      req.params.productId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'Product batch created successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function updateProductBatch(req, res, next) {
  try {
    const data = await productBatchService.updateProductBatch(
      req.params.batchId,
      req.user.storeId,
      req.body
    );

    res.json({
      success: true,
      message: 'Product batch updated successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function deleteProductBatch(req, res, next) {
  try {
    const data = await productBatchService.deleteProductBatch(
      req.params.batchId,
      req.user.storeId
    );

    res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProductBatches,
  getProductBatch,
  createProductBatch,
  updateProductBatch,
  deleteProductBatch,
};
