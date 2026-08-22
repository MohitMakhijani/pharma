const express = require('express');

const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  getSupplierLedger,
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


router.get(
  '/:supplierId/ledger',
  getSupplierLedger
);

module.exports = router;
