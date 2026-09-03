const prisma = require('../config/prisma');

async function getLiveNotifications(req, res) {
  try {
    const storeId = req.user.storeId;
    const userId = req.user.id;
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [expiringBatches, expiredBatches, lowStocks, pendingAyushman, draftSales, dueRefillReminders, userDismissals] = await Promise.all([
      // 1. Medicines Expiring within 30 Days
      prisma.productBatch.findMany({
        where: {
          storeId,
          product: { isDeleted: false },
          expiryDate: { gte: now, lte: in30Days },
          status: 'ACTIVE',
        },
        include: { product: true },
        take: 5,
        orderBy: { expiryDate: 'asc' },
      }),

      // 2. Already Expired Medicines
      prisma.productBatch.findMany({
        where: {
          storeId,
          product: { isDeleted: false },
          expiryDate: { lt: now },
        },
        include: { product: true },
        take: 5,
        orderBy: { expiryDate: 'desc' },
      }),

      // 3. Out of stock / Low stock items
      prisma.stock.findMany({
        where: {
          storeId,
          product: { isDeleted: false },
          quantity: { lte: 10 },
        },
        include: { product: true, batch: true },
        take: 5,
        orderBy: { quantity: 'asc' },
      }),

      // 4. Pending Ayushman Claims
      prisma.sale.findMany({
        where: {
          storeId,
          isDeleted: false,
          isAyushman: true,
          claimStatus: 'PENDING',
        },
        include: { customer: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),

      // 5. Unsaved / Pending Draft Sales
      prisma.sale.findMany({
        where: {
          storeId,
          isDeleted: false,
          status: 'DRAFT',
        },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      }),

      // 6. Due / Pending Patient Refill Reminders
      prisma.reminder.findMany({
        where: {
          storeId,
          isDeleted: false,
          status: 'PENDING',
          reminderDate: { lte: todayEnd },
        },
        include: { customer: true },
        take: 8,
        orderBy: { reminderDate: 'asc' },
      }),

      // 7. Persisted Read/Dismissed notifications in database
      prisma.notification.findMany({
        where: {
          storeId,
          isRead: true,
          OR: [{ userId }, { userId: null }],
        },
        select: {
          referenceId: true,
          id: true,
        },
      }),
    ]);

    const readReferenceSet = new Set(
      userDismissals.map((d) => d.referenceId || d.id).filter(Boolean)
    );

    const notifications = [];

    // Expired alerts
    expiredBatches.forEach((b) => {
      const refId = `exp-${b.id}`;
      notifications.push({
        id: refId,
        referenceId: refId,
        type: 'EXPIRED',
        category: 'warning',
        title: `Expired Drug: ${b.product?.name || 'Medicine'}`,
        message: `Batch ${b.batchNumber} expired on ${new Date(b.expiryDate).toLocaleDateString('en-IN')}. Please quarantine.`,
        link: '/modules/expiry-report',
        time: b.expiryDate,
        isRead: readReferenceSet.has(refId),
      });
    });

    // Expiring soon alerts
    expiringBatches.forEach((b) => {
      const refId = `expiring-${b.id}`;
      const daysLeft = Math.ceil((new Date(b.expiryDate).getTime() - now.getTime()) / (1000 * 3600 * 24));
      notifications.push({
        id: refId,
        referenceId: refId,
        type: 'EXPIRING_SOON',
        category: 'alert',
        title: `Expiring in ${daysLeft} days: ${b.product?.name || 'Medicine'}`,
        message: `Batch ${b.batchNumber} is set to expire on ${new Date(b.expiryDate).toLocaleDateString('en-IN')}.`,
        link: '/modules/expiry-report',
        time: b.expiryDate,
        isRead: readReferenceSet.has(refId),
      });
    });

    // Low stock alerts
    lowStocks.forEach((st) => {
      const refId = `stock-${st.id}`;
      notifications.push({
        id: refId,
        referenceId: refId,
        type: 'LOW_STOCK',
        category: 'danger',
        title: `Low Stock: ${st.product?.name || 'Medicine'}`,
        message: `Only ${Number(st.quantity || 0)} units left in Batch ${st.batch?.batchNumber || '—'}. Reorder recommended.`,
        link: '/products',
        time: st.updatedAt || now,
        isRead: readReferenceSet.has(refId),
      });
    });

    // Ayushman claim alerts
    pendingAyushman.forEach((sale) => {
      const refId = `ayush-${sale.id}`;
      notifications.push({
        id: refId,
        referenceId: refId,
        type: 'AYUSHMAN_PENDING',
        category: 'info',
        title: `Pending Ayushman Claim: ${sale.invoiceNumber}`,
        message: `Patient ${sale.customer?.name || 'Beneficiary'} (Card: ${sale.ayushmanCardNo || '—'}) claim is pending approval.`,
        link: '/modules/ayushman-sales',
        time: sale.createdAt,
        isRead: readReferenceSet.has(refId),
      });
    });

    // Draft sales alerts
    if (draftSales.length > 0) {
      const refId = `drafts-${draftSales[0]?.id || 'active'}`;
      notifications.push({
        id: refId,
        referenceId: refId,
        type: 'DRAFTS',
        category: 'neutral',
        title: `${draftSales.length} Active Sales Draft(s)`,
        message: 'You have unfinished POS draft bills waiting for checkout.',
        link: '/modules/sales-drafts',
        time: draftSales[0]?.updatedAt || now,
        isRead: readReferenceSet.has(refId),
      });
    }

    // 6. Patient Refill Reminders alerts (Due Today or Overdue)
    dueRefillReminders.forEach((rem) => {
      const refId = `refill-${rem.id}`;
      notifications.push({
        id: refId,
        referenceId: refId,
        type: 'REFILL_REMINDER',
        category: 'alert',
        title: `Refill Reminder: ${rem.drugName}`,
        message: `Patient ${rem.customer?.name || 'Customer'} is scheduled for a refill on ${new Date(rem.reminderDate).toLocaleDateString('en-IN')} (${rem.timesPerDay}x daily).`,
        link: '/sales/refill-reminders',
        time: rem.reminderDate,
        isRead: readReferenceSet.has(refId),
      });
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return res.json({
      success: true,
      data: {
        totalCount: notifications.length,
        unreadCount,
        notifications,
      },
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch live notifications',
    });
  }
}

async function markNotificationAsRead(req, res) {
  try {
    const storeId = req.user.storeId;
    const userId = req.user.id;
    const { referenceId, type, title, message } = req.body;

    if (!referenceId) {
      return res.status(400).json({ success: false, message: 'referenceId is required' });
    }

    // Persist as read in DB
    const existing = await prisma.notification.findFirst({
      where: {
        storeId,
        referenceId,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (existing) {
      await prisma.notification.update({
        where: { id: existing.id },
        data: { isRead: true, readAt: new Date() },
      });
    } else {
      await prisma.notification.create({
        data: {
          storeId,
          userId,
          referenceId,
          type: type || 'SYSTEM',
          title: title || 'Notification',
          message: message || '',
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    return res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark notification as read',
    });
  }
}

async function markAllNotificationsAsRead(req, res) {
  try {
    const storeId = req.user.storeId;
    const userId = req.user.id;
    const { referenceIds } = req.body; // Array of IDs to mark read

    if (Array.isArray(referenceIds) && referenceIds.length > 0) {
      for (const refId of referenceIds) {
        const existing = await prisma.notification.findFirst({
          where: {
            storeId,
            referenceId: refId,
            OR: [{ userId }, { userId: null }],
          },
        });

        if (existing) {
          await prisma.notification.update({
            where: { id: existing.id },
            data: { isRead: true, readAt: new Date() },
          });
        } else {
          await prisma.notification.create({
            data: {
              storeId,
              userId,
              referenceId: refId,
              type: 'SYSTEM',
              title: 'Store Alert',
              message: 'Alert read by user',
              isRead: true,
              readAt: new Date(),
            },
          });
        }
      }
    }

    return res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to mark all notifications as read',
    });
  }
}

module.exports = {
  getLiveNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
