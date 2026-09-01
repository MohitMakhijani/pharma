const express = require('express');

const router = express.Router();

const controller = require('../controllers/purchase.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post(
  '/purchases',
  controller.createPurchase
);

router.patch(
  '/purchases/:purchaseId',
  controller.updatePurchase
);

router.delete(
  '/purchases/:purchaseId',
  controller.deletePurchase
);

router.get(
  '/purchases',
  controller.getPurchases
);

router.get(
  '/purchases/drafts',
  controller.getPurchaseDrafts
);

router.get(
  '/purchases/:purchaseId',
  controller.getPurchaseById
);


router.post(
  '/purchases/:purchaseId/return',
  controller.createPurchaseReturn
);

router.get(
  '/purchase-returns',
  controller.getPurchaseReturns
);

router.get(
  '/purchase-returns/:returnId',
  controller.getPurchaseReturnById
);

router.post(
  '/purchase-returns/:returnId/cancel',
  controller.cancelPurchaseReturn
);


module.exports = router;
