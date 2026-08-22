const prisma = require('../config/prisma');

async function addPayment({
  storeId,
  purchaseId,
  amount,
  paymentMethod,
  referenceNumber,
  notes,
}) {
  const paymentAmount = Number(amount);

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    throw new Error('Payment amount must be greater than 0');
  }

  if (!paymentMethod) {
    throw new Error('Payment method is required');
  }

  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findFirst({
      where: {
        id: purchaseId,
        storeId,
      },
    });

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    /*
     * Calculate total amount returned from this purchase.
     * Only COMPLETED purchase returns reduce the payable.
     */
    const returnedResult =
      await tx.purchaseReturnItem.aggregate({
        where: {
          purchaseItem: {
            purchaseId,
          },
          purchaseReturn: {
            is: {
              status: 'COMPLETED',
            },
          },
        },
        _sum: {
          totalAmount: true,
        },
      });

    const returnedAmount =
      Number(returnedResult._sum.totalAmount || 0);

    /*
     * Effective payable after purchase returns.
     *
     * Example:
     * Purchase = 8960
     * Return   = 800
     * Payable  = 8160
     */
    const effectivePayable =
      Math.max(
        0,
        Number(purchase.totalAmount) - returnedAmount
      );

    const currentPaidAmount =
      Number(purchase.paidAmount);

    const currentDueAmount =
      Math.max(
        0,
        effectivePayable - currentPaidAmount
      );

    /*
     * Payment cannot exceed the current net payable.
     */
    if (paymentAmount > currentDueAmount) {
      throw new Error(
        `Payment cannot exceed due amount of ${currentDueAmount.toFixed(2)}`
      );
    }

    const payment =
      await tx.purchasePayment.create({
        data: {
          purchaseId,
          amount: paymentAmount,
          paymentMethod,
          referenceNumber:
            referenceNumber || null,
          notes:
            notes || null,
        },
      });

    const newPaidAmount =
      currentPaidAmount + paymentAmount;

    const newDueAmount =
      Math.max(
        0,
        effectivePayable - newPaidAmount
      );

    let paymentStatus = 'UNPAID';

    if (newDueAmount <= 0) {
      paymentStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      paymentStatus = 'PARTIAL';
    }

    await tx.purchase.update({
      where: {
        id: purchaseId,
      },
      data: {
        paidAmount: newPaidAmount,
        dueAmount: newDueAmount,
        paymentStatus,
      },
    });

    /*
     * Supplier ledger:
     * Purchase creates payable (+)
     * Payment settles payable (-)
     */
    await tx.ledgerEntry.create({
      data: {
        storeId,
        supplierId: purchase.supplierId,
        ledgerType: 'SUPPLIER',
        entryType: 'PURCHASE_PAYMENT',
        amount: -paymentAmount,
        referenceId: payment.id,
        referenceNumber:
          referenceNumber || null,
        description:
          `Payment against purchase ${purchase.invoiceNumber}`,
      },
    });

    return payment;
  });
}

async function getPayments(storeId, purchaseId) {
  const purchase = await prisma.purchase.findFirst({
    where: {
      id: purchaseId,
      storeId,
    },
  });

  if (!purchase) {
    throw new Error('Purchase not found');
  }

  return prisma.purchasePayment.findMany({
    where: {
      purchaseId,
    },
    orderBy: {
      paymentDate: 'desc',
    },
  });
}

module.exports = {
  addPayment,
  getPayments,
};
