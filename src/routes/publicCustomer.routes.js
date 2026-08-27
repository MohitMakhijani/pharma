const express = require('express');

const controller = require('../controllers/customer.controller');

const router = express.Router();

router.get('/customer-ledgers/:token', controller.getPublicCustomerLedger);

module.exports = router;