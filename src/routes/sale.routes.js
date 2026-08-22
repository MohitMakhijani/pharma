const express = require('express');

const router = express.Router();

const {
  createSale,
} = require('../controllers/sale.controller');

const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');


router.use(authenticate);


router.post(
  '/sales',
  authorize('ADMIN', 'PHARMACIST'),
  createSale
);


module.exports = router;
