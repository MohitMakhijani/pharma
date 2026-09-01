const service = require('../services/salesReturn.service');

async function createSalesReturn(req, res) {
  try {
    const data = await service.createSalesReturn({
      storeId: req.user.storeId,
      saleId: req.params.saleId,
      items: req.body.items,
      reason: req.body.reason,
    });

    return res.status(201).json({
      success: true,
      message: 'Sales return created',
      data,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

async function getSalesReturns(req, res) {
  try {
    const data = await service.getSalesReturns(req.user.storeId, req.query);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getSalesReturnById(req, res) {
  try {
    const data = await service.getSalesReturnById(req.user.storeId, req.params.id);
    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Sales return not found',
      });
    }
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function cancelSalesReturn(req, res) {
  try {
    const data = await service.cancelSalesReturn(req.user.storeId, req.params.id, req.user.id);
    return res.json({
      success: true,
      message: 'Sales return undone / cancelled successfully',
      data,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to cancel sales return',
    });
  }
}

module.exports = {
  createSalesReturn,
  getSalesReturns,
  getSalesReturnById,
  cancelSalesReturn,
};
