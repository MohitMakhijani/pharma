const express=require('express');

const router=express.Router();

const controller=require('../controllers/salesReturn.controller');

const {
authenticate
}=require('../middleware/auth.middleware');

const {
authorize
}=require('../middleware/role.middleware');


router.use(authenticate);


router.post(
 '/sales/:saleId/return',
 authorize('ADMIN','PHARMACIST'),
 controller.createSalesReturn
);


module.exports=router;
