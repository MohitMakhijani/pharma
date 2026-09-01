const express = require('express');
const router = express.Router();
const controller = require('../controllers/purchasesReport.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get(
  '/report',
  authorize('ADMIN', 'PHARMACIST', 'PURCHASER', 'ACCOUNTANT'),
  controller.getPurchasesReport
);

module.exports = router;
