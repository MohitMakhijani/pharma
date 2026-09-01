const express = require('express');
const router = express.Router();
const controller = require('../controllers/restock.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get(
  '/suggestions',
  authorize('ADMIN', 'PHARMACIST', 'PURCHASER'),
  controller.getRestockSuggestions
);

router.post(
  '/orders/draft',
  authorize('ADMIN', 'PHARMACIST', 'PURCHASER'),
  controller.createPurchaseOrderDraft
);

module.exports = router;
