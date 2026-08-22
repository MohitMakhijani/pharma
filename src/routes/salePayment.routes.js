const express = require('express');

const router = express.Router();

const controller = require('../controllers/salePayment.controller');

const {
 authenticate
}=require('../middleware/auth.middleware');

const {
 authorize
}=require('../middleware/role.middleware');


router.use(authenticate);


router.post(
 '/sales/:saleId/payments',
 authorize('ADMIN','PHARMACIST'),
 controller.addPayment
);


router.get(
 '/sales/:saleId/payments',
 authorize('ADMIN','PHARMACIST'),
 controller.getPayments
);


module.exports=router;
