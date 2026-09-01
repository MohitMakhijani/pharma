const express = require('express');
const router = express.Router();
const controller = require('../controllers/advancedSalesReport.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get(
  '/advanced',
  authorize('ADMIN', 'PHARMACIST', 'ACCOUNTANT'),
  controller.getAdvancedSalesReport
);

module.exports = router;
