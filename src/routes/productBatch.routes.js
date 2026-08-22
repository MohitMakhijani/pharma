const express = require('express');

const router = express.Router();

const controller = require('../controllers/productBatch.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get(
  '/products/:productId/batches',
  controller.getProductBatches
);

router.get(
  '/batches/:batchId',
  controller.getProductBatch
);

router.post(
  '/products/:productId/batches',
  controller.createProductBatch
);

router.patch(
  '/batches/:batchId',
  controller.updateProductBatch
);

router.delete(
  '/batches/:batchId',
  controller.deleteProductBatch
);

module.exports = router;
