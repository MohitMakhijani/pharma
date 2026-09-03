const express = require('express');
const router = express.Router();
const controller = require('../controllers/notifications.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET /api/notifications - Get live alerts merged with read status
router.get('/', controller.getLiveNotifications);

// POST /api/notifications/read - Mark single notification as read
router.post('/read', controller.markNotificationAsRead);

// POST /api/notifications/read-all - Mark all notifications as read
router.post('/read-all', controller.markAllNotificationsAsRead);

module.exports = router;
