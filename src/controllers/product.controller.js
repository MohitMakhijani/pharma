const productService = require('../services/product.service');

async function getProducts(req, res, next) {
  try {
    const data = await productService.getProducts(req.user.storeId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function getSalts(req, res, next) {
  try {
    const data = await productService.getSalts(req.query.search || '');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function mapProductToSalt(req, res, next) {
  try {
    const data = await productService.mapProductToSalt(req.params.productId, req.user.storeId, req.body.saltId);
    if (!data) return res.status(404).json({ success: false, message: 'Product not found' });
    res.status(201).json({ success: true, message: 'Salt mapped successfully', data });
  } catch (error) {
    next(error);
  }
}

async function createSalt(req, res, next) {
  try {
    const data = await productService.createSalt(req.body.name);
    if (!data) return res.status(400).json({ success: false, message: 'Salt name is required' });
    res.status(201).json({ success: true, message: 'Salt created successfully', data });
  } catch (error) {
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const data = await productService.getProduct(
      req.params.productId,
      req.user.storeId
    );

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
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

async function createProduct(req, res, next) {
  try {
    const data = await productService.createProduct(
      req.user.storeId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data,
    });
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const result = await productService.updateProduct(
      req.params.productId,
      req.user.storeId,
      req.body
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const data = await productService.getProduct(req.params.productId, req.user.storeId);
    res.json({ success: true, message: 'Product updated successfully', data });
  } catch (error) {
    next(error);
  }
}

async function getProductPurchaseHistory(req, res, next) {
  try {
    const data = await productService.getProductPurchaseHistory(
      req.params.productId,
      req.user.storeId
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getProducts,
  getSalts,
  mapProductToSalt,
  createSalt,
  getProduct,
  createProduct,
  updateProduct,
  getProductPurchaseHistory,
};
