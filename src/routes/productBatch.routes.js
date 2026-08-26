const express = require('express');

const router = express.Router();

const controller = require('../controllers/productBatch.controller');
const { authenticate } = require('../middleware/auth.middleware');
const prisma = require('../config/prisma');

router.use(authenticate);

router.get('/products/:productId/packaging', async (req, res, next) => {
  try {
    const packaging = await prisma.productPackaging.findMany({
      where: { productId: req.params.productId },
      include: { unit: true },
      orderBy: { conversionToBase: 'asc' },
    });
    res.json({ success: true, data: packaging });
  } catch (error) {
    next(error);
  }
});

router.post('/products/:productId/packaging', async (req, res, next) => {
  try {
    const packaging = await prisma.productPackaging.create({
      data: {
        productId: req.params.productId,
        name: req.body.name,
        unitId: req.body.unitId,
        conversionToBase: Number(req.body.conversionToBase),
        isSellable: req.body.isSellable !== false,
        isPurchaseUnit: req.body.isPurchaseUnit !== false,
        sellingPrice: req.body.sellingPrice ? Number(req.body.sellingPrice) : null,
        mrp: req.body.mrp ? Number(req.body.mrp) : null,
      },
      include: { unit: true },
    });
    res.status(201).json({ success: true, data: packaging });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/products/:productId/batches',
  controller.getProductBatches
);

router.get(
  '/batches/:batchId',
  controller.getProductBatch
);

router.post(
  '/products/:productId/batches',
  controller.createProductBatch
);

router.patch(
  '/batches/:batchId',
  controller.updateProductBatch
);

router.delete(
  '/batches/:batchId',
  controller.deleteProductBatch
);

module.exports = router;
