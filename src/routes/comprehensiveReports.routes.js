const express = require('express');
const router = express.Router();
const controller = require('../controllers/comprehensiveReports.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/margin', controller.getMarginReports);
router.get('/stock', controller.getStockReports);
router.get('/entelligent', controller.getEntelligentReports);
router.get('/others', controller.getOthersReports);
router.get('/accounting', controller.getAccountingReports);

module.exports = router;
