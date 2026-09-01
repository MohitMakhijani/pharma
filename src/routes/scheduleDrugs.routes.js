const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduleDrugReport.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get(
  '/report',
  authorize('ADMIN', 'PHARMACIST'),
  controller.getScheduleDrugReport
);

module.exports = router;
