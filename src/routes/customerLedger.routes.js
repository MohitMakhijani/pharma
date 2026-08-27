const express = require('express');

const {
  getCustomerLedger,
  addCustomerPayment,
} = require('../controllers/customerLedger.controller');

const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

router.get(
  '/:customerId/ledger',
  authorize('ADMIN', 'PHARMACIST'),
  getCustomerLedger
);

router.post(
  '/:customerId/payments',
  authorize('ADMIN', 'PHARMACIST'),
  addCustomerPayment
);

module.exports = router;
