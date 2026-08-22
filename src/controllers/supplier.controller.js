const supplierService = require('../services/supplier.service');

async function getSuppliers(req, res, next) {
  try {
    const suppliers = await supplierService.getSuppliers(
      req.user.storeId
    );

    res.json({
      success: true,
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
}

async function getSupplierById(req, res, next) {
  try {
    const supplier = await supplierService.getSupplierById(
      req.params.id,
      req.user.storeId
    );

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    res.json({
      success: true,
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
}

async function createSupplier(req, res, next) {
  try {
    const supplier = await supplierService.createSupplier(
      req.body,
      req.user.storeId
    );

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
}

async function updateSupplier(req, res, next) {
  try {
    const supplier = await supplierService.updateSupplier(
      req.params.id,
      req.user.storeId,
      req.body
    );

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier,
    });
  } catch (error) {
    next(error);
  }
}


async function getSupplierLedger(req, res) {
  try {
    const ledger = await supplierService.getSupplierLedger(
      req.params.supplierId,
      req.user.storeId
    );

    return res.json({
      success: true,
      data: ledger,
    });
  } catch (error) {
    console.error('Get supplier ledger error:', error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to fetch supplier ledger',
    });
  }
}

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  getSupplierLedger,
};
