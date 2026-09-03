const express = require('express');

const { getUsers, getUserById, createUser, updateUser, getRoles } = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.get(
  '/roles',
  authenticate,
  getRoles
);

router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  createUser
);

router.patch(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  updateUser
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  getUserById
);

router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  getUsers
);

module.exports = router;
