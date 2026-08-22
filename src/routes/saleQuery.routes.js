const express = require('express');

const router = express.Router();

const controller = require('../controllers/saleQuery.controller');

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
 controller.getSales
);


router.get(
 '/:id',
 authorize('ADMIN','PHARMACIST'),
 controller.getSaleById
);


module.exports = router;
