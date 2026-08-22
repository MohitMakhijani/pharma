const express = require('express');

const router = express.Router();

const controller = require('../controllers/dashboard.controller');

const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  controller.getDashboard
);

module.exports = router;
