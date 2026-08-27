const express = require('express');

const router = express.Router();

const controller = require('../controllers/stock.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/inventory/export', controller.exportStock);
router.post('/inventory/audits', controller.createInventoryAudit);
router.get('/inventory/audits/:auditId', controller.getInventoryAudit);
router.post('/inventory/audits/:auditId/complete', controller.completeInventoryAudit);
router.post('/inventory/import', controller.importStock);

router.get(
  '/products/:productId/stock',
  controller.getProductStock
);

router.get(
  '/batches/:batchId/stock',
  controller.getBatchStock
);

router.post(
  '/batches/:batchId/stock',
  controller.addStock
);

router.post(
  '/batches/:batchId/stock/adjust',
  controller.adjustStock
);

router.post(
  '/batches/:batchId/stock/reserve',
  controller.reserveStock
);

router.post(
  '/batches/:batchId/stock/release',
  controller.releaseStock
);

router.get(
  '/products/:productId/stock/movements',
  controller.getProductMovements
);

router.get(
  '/batches/:batchId/stock/movements',
  controller.getBatchMovements
);


router.post(
  '/batches/:batchId/stock/sell',
  controller.sellStock
);

router.post(
  '/batches/:batchId/stock/sales-return',
  controller.salesReturn
);


router.post(
  '/batches/:batchId/stock/purchase-return',
  controller.purchaseReturn
);


router.post(
  '/batches/:batchId/stock/damage',
  controller.damageStock
);


router.post(
  '/batches/:batchId/stock/confirm-sale',
  controller.confirmSale
);


router.post(
  '/batches/:batchId/stock/expire',
  controller.expireStock
);


router.post(
  '/batches/:batchId/stock/transfer',
  controller.transferStock
);

module.exports = router;
