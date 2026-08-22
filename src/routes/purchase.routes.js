const express = require('express');

const router = express.Router();

const controller = require('../controllers/purchase.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post(
  '/purchases',
  controller.createPurchase
);

router.get(
  '/purchases',
  controller.getPurchases
);

router.get(
  '/purchases/:purchaseId',
  controller.getPurchaseById
);


router.post(
  '/purchases/:purchaseId/return',
  controller.createPurchaseReturn
);


module.exports = router;
