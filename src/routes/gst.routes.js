const express = require('express');
const router = express.Router();
const controller = require('../controllers/gstReport.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get(
  '/report',
  authorize('ADMIN', 'PHARMACIST', 'ACCOUNTANT'),
  controller.getGstReport
);

module.exports = router;
