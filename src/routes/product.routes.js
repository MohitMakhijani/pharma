const express = require('express');

const router = express.Router();

const controller = require('../controllers/product.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', controller.getProducts);

router.get('/salts', controller.getSalts);

router.post('/salts', controller.createSalt);

router.post('/:productId/salts', controller.mapProductToSalt);

router.get('/:productId/purchase-history', controller.getProductPurchaseHistory);

router.get('/:productId', controller.getProduct);

router.patch('/:productId', controller.updateProduct);

router.post('/', controller.createProduct);

module.exports = router;
