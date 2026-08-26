const express = require('express');
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const [categories, manufacturers, units] = await Promise.all([
      prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.manufacturer.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
      prisma.unit.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    ]);
    res.json({ success: true, data: { categories, manufacturers, units } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
