const express = require('express');

const {
  register,
  login,
  me,
} = require('../controllers/auth.controller');

const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

const router = express.Router();

router.post('/register', register);

router.post('/login', (req, res, next) => {
  console.log('🔥 LOGIN ROUTE HIT');
  console.log('Authorization header:', req.headers.authorization);
  next();
}, login);

router.get('/me', authenticate, me);

router.get(
  '/admin-test',
  authenticate,
  authorize('ADMIN'),
  (req, res) => {
    res.json({
      success: true,
      message: 'Admin authorization working',
      user: req.user,
    });
  }
);

router.get(
  '/role-test',
  authenticate,
  authorize(
    'ADMIN',
    'PHARMACIST',
    'INVENTORY_MANAGER',
    'CASHIER'
  ),
  (req, res) => {
    res.json({
      success: true,
      message: 'Role authorization working',
      role: req.user.role,
      userId: req.user.userId,
      storeId: req.user.storeId,
    });
  }
);

module.exports = router;
