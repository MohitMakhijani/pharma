const express = require('express');
const router = express.Router();
const controller = require('../controllers/collectionReport.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get(
  '/report',
  authorize('ADMIN', 'PHARMACIST', 'CASHIER', 'ACCOUNTANT'),
  controller.getCollectionReport
);

module.exports = router;
