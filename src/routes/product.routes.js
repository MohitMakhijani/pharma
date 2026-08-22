const express = require('express');

const router = express.Router();

const controller = require('../controllers/product.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', controller.getProducts);

router.get('/:productId', controller.getProduct);

router.post('/', controller.createProduct);

module.exports = router;
