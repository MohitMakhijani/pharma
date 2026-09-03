const express = require('express');
const router = express.Router();
const controller = require('../controllers/reminder.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET /api/reminders - List reminders with filter options
router.get('/', controller.getReminders);

// POST /api/reminders - Create a new reminder
router.post('/', controller.createReminder);

// PATCH /api/reminders/:id/status - Update reminder status (e.g. COMPLETED)
router.patch('/:id/status', controller.updateReminderStatus);

// DELETE /api/reminders/:id - Soft delete reminder
router.delete('/:id', controller.deleteReminder);

module.exports = router;
