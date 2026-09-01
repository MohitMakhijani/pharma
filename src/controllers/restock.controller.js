const service = require('../services/restock.service');

async function getRestockSuggestions(req, res) {
  try {
    const data = await service.getRestockSuggestions(req.user.storeId, req.query);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Restock suggestions error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load restock suggestions',
    });
  }
}

async function createPurchaseOrderDraft(req, res) {
  try {
    const data = await service.createPurchaseOrderDraft(
      req.user.storeId,
      req.body.supplierId,
      req.body.items
    );
    return res.status(201).json({
      success: true,
      message: 'Purchase order draft created successfully',
      data,
    });
  } catch (error) {
    console.error('Create PO draft error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create purchase order',
    });
  }
}

module.exports = {
  getRestockSuggestions,
  createPurchaseOrderDraft,
};
