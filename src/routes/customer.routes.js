const express = require('express');

const router = express.Router();

const controller = require('../controllers/customer.controller');

const {
  authenticate
} = require('../middleware/auth.middleware');

const {
  authorize
} = require('../middleware/role.middleware');


router.use(authenticate);


router.get(
  '/',
  authorize('ADMIN','PHARMACIST'),
  controller.getCustomers
);


router.get(
  '/:id',
  authorize('ADMIN','PHARMACIST'),
  controller.getCustomerById
);


router.post(
  '/',
  authorize('ADMIN','PHARMACIST'),
  controller.createCustomer
);


router.patch(
  '/:id',
  authorize('ADMIN','PHARMACIST'),
  controller.updateCustomer
);


module.exports = router;
