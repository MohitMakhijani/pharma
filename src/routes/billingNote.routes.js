const express = require('express');
const router = express.Router();
const controller = require('../controllers/billingNote.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get(
  '/',
  controller.getBillingNotes
);

router.post(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  controller.createBillingNote
);

router.delete(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  controller.deleteBillingNote
);

module.exports = router;
