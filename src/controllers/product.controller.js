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

module.exports = {
  getProducts,
  getProduct,
  createProduct,
};
