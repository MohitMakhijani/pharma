const purchaseService = require('../services/purchase.service');

async function createPurchase(req, res) {
  try {
    const purchase = await purchaseService.createPurchase({
      storeId: req.user.storeId,
      supplierId: req.body.supplierId,
      invoiceNumber: req.body.invoiceNumber,
      invoiceDate: req.body.invoiceDate,
      items: req.body.items,
      notes: req.body.notes,
      status: req.body.status,
      purchaseId: req.body.purchaseId,
    });

    return res.status(201).json({
      success: true,
      message: req.body.status === 'DRAFT' ? 'Purchase draft saved successfully' : 'Purchase created successfully',
      data: purchase,
    });
  } catch (error) {
    console.error('Create purchase error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create purchase',
    });
  }
}

async function updatePurchase(req, res) {
  try {
    const purchase = await purchaseService.createPurchase({
      storeId: req.user.storeId,
      supplierId: req.body.supplierId,
      invoiceNumber: req.body.invoiceNumber,
      invoiceDate: req.body.invoiceDate,
      items: req.body.items,
      notes: req.body.notes,
      status: req.body.status,
      purchaseId: req.params.purchaseId,
    });

    return res.json({
      success: true,
      message: req.body.status === 'DRAFT' ? 'Purchase draft updated successfully' : 'Purchase saved successfully',
      data: purchase,
    });
  } catch (error) {
    console.error('Update purchase error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to update purchase',
    });
  }
}

async function getPurchases(req, res) {
  try {
    const purchases = await purchaseService.getPurchases(
      req.user.storeId,
      {
        search: String(req.query.search || '').trim(),
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
      }
    );

    return res.json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    console.error('Get purchases error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch purchases',
    });
  }
}

async function getPurchaseDrafts(req, res) {
  try {
    const drafts = await purchaseService.getDraftPurchases(req.user.storeId);

    return res.json({
      success: true,
      data: drafts,
    });
  } catch (error) {
    console.error('Get purchase drafts error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch purchase drafts',
    });
  }
}

async function deletePurchase(req, res) {
  try {
    const purchase = await purchaseService.deletePurchase(
      req.user.storeId,
      req.params.purchaseId
    );

    return res.json({
      success: true,
      message: 'Purchase deleted successfully',
      data: purchase,
    });
  } catch (error) {
    console.error('Delete purchase error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete purchase',
    });
  }
}

async function getPurchaseById(req, res) {
  try {
    const purchase = await purchaseService.getPurchaseById(
      req.user.storeId,
      req.params.purchaseId
    );

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found',
      });
    }

    return res.json({
      success: true,
      data: purchase,
    });
  } catch (error) {
    console.error('Get purchase error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch purchase',
    });
  }
}



async function createPurchaseReturn(req, res) {
  try {
    const purchaseReturn =
      await require('../services/purchaseReturn.service')
        .createPurchaseReturn({
          storeId: req.user.storeId,
          purchaseId: req.params.purchaseId || req.body.originalPurchaseId,
          supplierId: req.body.supplierId,
          returnDate: req.body.returnDate,
          items: req.body.items,
          reason: req.body.reason,
          notes: req.body.notes,
        });

    return res.status(201).json({
      success: true,
      message: 'Purchase return created successfully',
      data: purchaseReturn,
    });

  } catch (error) {
    console.error('Create purchase return error:', error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to create purchase return',
    });
  }
}


module.exports = {
  createPurchase,
  updatePurchase,
  getPurchases,
  getPurchaseDrafts,
  deletePurchase,
  getPurchaseById,
  createPurchaseReturn,
};
