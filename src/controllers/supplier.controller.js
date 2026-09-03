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

async function addSupplierPayment(req, res) {
  try {
    const payment = await supplierService.addSupplierPayment({ supplierId: req.params.id, storeId: req.user.storeId, amount: req.body.amount, paymentMethod: req.body.paymentMethod, referenceNumber: req.body.referenceNumber, notes: req.body.notes });
    return res.status(201).json({ success: true, message: 'Supplier payment recorded successfully', data: payment });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Failed to record supplier payment' });
  }
}

async function exportSuppliers(req, res, next) {
  try {
    const csv = await supplierService.exportSuppliers(req.user.storeId, req.body?.columns || []);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="suppliers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
}

async function importSuppliers(req, res, next) {
  try {
    const result = await supplierService.importSuppliers(req.user.storeId, req.body.rows);
    res.status(201).json({ success: true, message: 'Suppliers imported successfully', data: result });
  } catch (error) { next(error); }
}

async function deleteSupplier(req, res, next) {
  try {
    const result = await supplierService.deleteSupplier(req.params.id, req.user.storeId);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    res.json({ success: true, message: 'Supplier moved to trash', data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger,
  addSupplierPayment,
  exportSuppliers,
  importSuppliers,
};
