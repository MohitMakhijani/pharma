const prisma = require('../config/prisma');

// GET /api/reminders
async function getReminders(req, res) {
  try {
    const storeId = req.user.storeId;
    const { status, filter, customerId } = req.query;

    const where = {
      storeId,
      isDeleted: false,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    if (filter === 'TODAY') {
      where.reminderDate = {
        gte: todayStart,
        lte: todayEnd,
      };
      if (status && status !== 'ALL') {
        where.status = status;
      }
    } else if (filter === 'UPCOMING') {
      where.reminderDate = {
        gt: todayEnd,
      };
      if (status && status !== 'ALL') {
        where.status = status;
      }
    } else if (filter === 'OVERDUE') {
      where.reminderDate = {
        lt: todayStart,
      };
      where.status = 'PENDING';
    } else if (status && status !== 'ALL') {
      where.status = status;
    }

    const reminders = await prisma.reminder.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            city: true,
          },
        },
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            invoiceDate: true,
          },
        },
      },
      orderBy: [
        { reminderDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Compute stats for header badge
    const [todayCount, totalPendingCount] = await Promise.all([
      prisma.reminder.count({
        where: {
          storeId,
          isDeleted: false,
          status: 'PENDING',
          reminderDate: {
            lte: todayEnd,
          },
        },
      }),
      prisma.reminder.count({
        where: {
          storeId,
          isDeleted: false,
          status: 'PENDING',
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        reminders,
        stats: {
          todayCount,
          totalPendingCount,
        },
      },
    });
  } catch (error) {
    console.error('Get reminders error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch reminders',
    });
  }
}

// POST /api/reminders
async function createReminder(req, res) {
  try {
    const storeId = req.user.storeId;
    const {
      customerId,
      saleId,
      drugName,
      reminderDate,
      reminderTime,
      timesPerDay,
      mealTiming,
      dosageInstructions,
      notes,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'Customer ID is required' });
    }
    if (!drugName) {
      return res.status(400).json({ success: false, message: 'Drug/Medicine name is required' });
    }
    if (!reminderDate) {
      return res.status(400).json({ success: false, message: 'Reminder Date is required' });
    }

    const reminder = await prisma.reminder.create({
      data: {
        storeId,
        customerId,
        saleId: saleId || null,
        drugName: String(drugName).trim(),
        reminderDate: new Date(reminderDate),
        reminderTime: reminderTime || '08:00 AM',
        timesPerDay: Number(timesPerDay) || 1,
        mealTiming: mealTiming || 'AFTER_MEAL',
        dosageInstructions: dosageInstructions || null,
        notes: notes || null,
        status: 'PENDING',
      },
      include: {
        customer: true,
        sale: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Medication reminder created successfully',
      data: reminder,
    });
  } catch (error) {
    console.error('Create reminder error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create reminder',
    });
  }
}

// PATCH /api/reminders/:id/status
async function updateReminderStatus(req, res) {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;
    const { status } = req.body; // 'COMPLETED', 'PENDING', 'CANCELLED', 'SENT'

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const existing = await prisma.reminder.findFirst({
      where: { id, storeId, isDeleted: false },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }

    const updated = await prisma.reminder.update({
      where: { id },
      data: { status },
      include: { customer: true },
    });

    return res.json({
      success: true,
      message: `Reminder marked as ${status}`,
      data: updated,
    });
  } catch (error) {
    console.error('Update reminder status error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update reminder status',
    });
  }
}

// DELETE /api/reminders/:id
async function deleteReminder(req, res) {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;

    const existing = await prisma.reminder.findFirst({
      where: { id, storeId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }

    await prisma.reminder.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return res.json({
      success: true,
      message: 'Reminder deleted successfully',
    });
  } catch (error) {
    console.error('Delete reminder error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete reminder',
    });
  }
}

module.exports = {
  getReminders,
  createReminder,
  updateReminderStatus,
  deleteReminder,
};
