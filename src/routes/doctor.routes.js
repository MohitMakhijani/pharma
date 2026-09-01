const express = require('express');
const router = express.Router();

const {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
} = require('../controllers/doctor.controller');

const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

router.get(
  '/doctors',
  authorize('ADMIN', 'PHARMACIST', 'CASHIER'),
  getDoctors
);

router.get(
  '/doctors/:id',
  authorize('ADMIN', 'PHARMACIST', 'CASHIER'),
  getDoctorById
);

router.post(
  '/doctors',
  authorize('ADMIN', 'PHARMACIST'),
  createDoctor
);

router.put(
  '/doctors/:id',
  authorize('ADMIN', 'PHARMACIST'),
  updateDoctor
);

router.delete(
  '/doctors/:id',
  authorize('ADMIN'),
  deleteDoctor
);

module.exports = router;
