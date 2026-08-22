const express = require('express');

const router = express.Router();

const controller = require('../controllers/productSupplier.controller');

const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get(
  '/products/:productId/suppliers',
  controller.getProductSuppliers
);

router.post(
  '/products/:productId/suppliers',
  controller.addProductSupplier
);

router.patch(
  '/products/:productId/suppliers/:supplierId',
  controller.updateProductSupplier
);

router.delete(
  '/products/:productId/suppliers/:supplierId',
  controller.removeProductSupplier
);

router.get(
  '/suppliers/:supplierId/products',
  controller.getSupplierProducts
);

module.exports = router;
