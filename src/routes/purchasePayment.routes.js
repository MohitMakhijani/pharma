const express = require('express');

const router = express.Router();

const controller = require('../controllers/purchasePayment.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.post(
  '/purchases/:purchaseId/payments',
  controller.addPayment
);

router.get(
  '/purchases/:purchaseId/payments',
  controller.getPayments
);

module.exports = router;
