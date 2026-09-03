const express = require('express');

const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  getSupplierLedger,
  addSupplierPayment,
  exportSuppliers,
  importSuppliers,
} = require('../controllers/supplier.controller');

const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.use(authenticate);

router.get(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  getSuppliers
);

router.post('/export', authorize('ADMIN', 'PHARMACIST'), exportSuppliers);

router.post('/import', authorize('ADMIN', 'PHARMACIST'), importSuppliers);

router.get(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  getSupplierById
);

router.post(
  '/',
  authorize('ADMIN', 'PHARMACIST'),
  createSupplier
);

router.patch(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  updateSupplier
);

router.delete(
  '/:id',
  authorize('ADMIN', 'PHARMACIST'),
  require('../controllers/supplier.controller').deleteSupplier
);


router.get(
  '/:supplierId/ledger',
  getSupplierLedger
);

router.post(
  '/:id/payments',
  authorize('ADMIN', 'PHARMACIST'),
  addSupplierPayment
);

module.exports = router;
