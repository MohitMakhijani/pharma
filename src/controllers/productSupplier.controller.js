const productSupplierService = require('../services/productSupplier.service');

async function getProductSuppliers(req, res, next) {
  try {
    const data = await productSupplierService.getProductSuppliers(
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

async function addProductSupplier(req, res, next) {
  try {
    const data = await productSupplierService.addProductSupplier(
      req.params.productId,
      req.user.storeId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'Supplier linked to product successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function updateProductSupplier(req, res, next) {
  try {
    const data = await productSupplierService.updateProductSupplier(
      req.params.productId,
      req.params.supplierId,
      req.user.storeId,
      req.body
    );

    res.json({
      success: true,
      message: 'Product supplier updated successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function removeProductSupplier(req, res, next) {
  try {
    const data = await productSupplierService.removeProductSupplier(
      req.params.productId,
      req.params.supplierId,
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

async function getSupplierProducts(req, res, next) {
  try {
    const data = await productSupplierService.getSupplierProducts(
      req.params.supplierId,
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

module.exports = {
  getProductSuppliers,
  addProductSupplier,
  updateProductSupplier,
  removeProductSupplier,
  getSupplierProducts,
};
