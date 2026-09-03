const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET /api/search?q=query
router.get('/', searchController.globalSearch);

module.exports = router;
