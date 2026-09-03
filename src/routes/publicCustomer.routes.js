const express = require('express');

const customerController = require('../controllers/customer.controller');
const saleController = require('../controllers/sale.controller');

const router = express.Router();

router.get('/customer-ledgers/:token', customerController.getPublicCustomerLedger);
router.get('/invoice/:id', saleController.getPublicSharedInvoice);
router.get('/shared/invoice/:id', saleController.getPublicSharedInvoice);

module.exports = router;