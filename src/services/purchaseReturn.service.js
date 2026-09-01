const prisma = require('../config/prisma');
async function createPurchaseReturn({
  storeId,
  purchaseId,
  supplierId,
  returnDate,
  items,
  reason,
  notes,
}) {

  if (!storeId) {
    throw new Error('Store ID is required');
  }

  if (!purchaseId) {
    throw new Error('Purchase ID is required');
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one purchase return item is required');
  }

  if (returnDate && Number.isNaN(new Date(returnDate).getTime())) {
    throw new Error('Return date must be a valid date');
  }


  return prisma.$transaction(async (tx) => {

    /*
     * Find purchase belonging to current store.
     */
    const purchase = await tx.purchase.findFirst({
      where: {
        id: purchaseId,
        storeId,
      },
      include: {
        items: {
          include: {
            batch: true,
          },
        },
      },
    });


    if (!purchase) {
      throw new Error('Purchase not found');
    }

    if (supplierId && supplierId !== purchase.supplierId) {
      throw new Error('Supplier does not match the original purchase');
    }


    if (
      purchase.status === 'CANCELLED'
    ) {
      throw new Error('Cannot return a cancelled purchase');
    }


    if (
      purchase.status === 'FULLY_RETURNED'
    ) {
      throw new Error('Purchase is already fully returned');
    }


    let totalAmount = 0;

    const returnItems = [];

    /*
     * Track quantities requested multiple times
     * for the same purchase item in this request.
     */
    const requestedByItem = new Map();


    for (const item of items) {

      const qty = Number(item.returnQty ?? item.quantity);


      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('Return quantity must be greater than 0');
      }


      const purchaseItemId = item.purchaseItemId;
      const purchaseItem = purchase.items.find((pi) => {
        if (purchaseItemId) return pi.id === purchaseItemId;
        return pi.productId === item.productId && pi.batch?.batchNumber === item.batchNo;
      });


      if (!purchaseItem) {
        throw new Error(
          `Purchase item ${item.purchaseItemId} does not belong to purchase ${purchaseId}`
        );
      }


      /*
       * Calculate quantity already returned.
       */
      const returnedResult =
        await tx.purchaseReturnItem.aggregate({
          where: {
            purchaseItemId: purchaseItem.id,
            purchaseReturn: {
              is: {
                status: 'COMPLETED',
              },
            },
          },
          _sum: {
            quantity: true,
          },
        });


      const alreadyReturned =
        Number(returnedResult._sum.quantity || 0);


      const previousRequested =
        requestedByItem.get(purchaseItem.id) || 0;


      const requestedTotal =
        previousRequested + qty;


      const purchasedQuantity =
        Number(purchaseItem.quantity);


      const remainingQuantity =
        purchasedQuantity - alreadyReturned;


      const remainingAfterRequest =
        remainingQuantity - requestedTotal;


      if (remainingAfterRequest < 0) {

        throw new Error(
          `Cannot return ${qty} for purchase item ${purchaseItem.id}. ` +
          `Purchased: ${purchasedQuantity}, ` +
          `Already returned: ${alreadyReturned}, ` +
          `Requested in this request: ${requestedTotal}, ` +
          `Remaining: ${Math.max(
            0,
            remainingQuantity - previousRequested
          )}`
        );

      }


      requestedByItem.set(
        purchaseItem.id,
        requestedTotal
      );


      const rate = item.rate !== undefined ? Number(item.rate) : Number(purchaseItem.purchasePrice);
      if (!Number.isFinite(rate) || rate < 0) throw new Error('Return rate must be a valid non-negative number');
      const taxPercent = Number(item.taxPercent || 0);
      if (!Number.isFinite(taxPercent) || taxPercent < 0) throw new Error('Tax percent must be valid');
      const amount = qty * rate;
      const taxAmount = amount * (taxPercent / 100);


      totalAmount += amount + taxAmount;


      returnItems.push({

        purchaseItemId: purchaseItem.id,

        productId: purchaseItem.productId,

        batchId: purchaseItem.batchId,

        packagingId:
          purchaseItem.packagingId || null,

        quantity: qty,

        baseQuantity:
          item.baseQuantity !== undefined &&
          item.baseQuantity !== null
            ? Number(item.baseQuantity)
            : qty,

        unitPrice:
          purchaseItem.purchasePrice,

        totalAmount: amount + taxAmount,

        reason:
          item.reason || reason || null,

      });

    }


    /*
     * Create purchase return.
     */
    const purchaseReturn =
      await tx.purchaseReturn.create({

        data: {

          storeId,

          supplierId:
            purchase.supplierId,

          returnNumber:
            `PR-${Date.now()}`,

          returnDate: returnDate ? new Date(returnDate) : new Date(),

          status:
            'COMPLETED',

          subtotal: returnItems.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0),

          taxAmount: returnItems.reduce((sum, item) => sum + (Number(item.totalAmount) - Number(item.quantity) * Number(item.unitPrice)), 0),

          totalAmount,

          reason:
            reason || null,

          notes:
            notes || null,

          items: {
            create: returnItems,
          },

        },

      });


    /*
     * Remove returned stock.
     */
    for (const item of returnItems) {
      const stock = await tx.stock.findFirst({
        where: { storeId, productId: item.productId, batchId: item.batchId },
      });
      if (!stock) throw new Error(`Stock not found for product ${item.productId} and batch ${item.batchId}`);

      const currentQuantity = Number(stock.quantity);
      const reservedQuantity = Number(stock.reservedQuantity);
      const availableQuantity = currentQuantity - reservedQuantity;
      if (Number(item.baseQuantity) > availableQuantity) {
        throw new Error(`Insufficient available stock. Available: ${availableQuantity}`);
      }

      const quantityAfter = currentQuantity - Number(item.baseQuantity);
      await tx.stock.update({ where: { id: stock.id }, data: { quantity: quantityAfter } });
      await tx.stockMovement.create({
        data: {
          storeId,
          productId: item.productId,
          batchId: item.batchId,
          stockId: stock.id,
          type: 'PURCHASE_RETURN',
          referenceType: 'PURCHASE_RETURN',
          quantity: -Number(item.baseQuantity),
          quantityBefore: currentQuantity,
          quantityAfter,
          unitCost: item.unitPrice,
          referenceId: purchaseReturn.id,
          reason: `Purchase return ${purchaseReturn.returnNumber}`,
        },
      });

    }


    /*
     * Determine new purchase status.
     */
    let allFullyReturned = true;
    let anyReturned = false;


    for (const purchaseItem of purchase.items) {

      const returnedResult =
        await tx.purchaseReturnItem.aggregate({
          where: {
            purchaseItemId:
              purchaseItem.id,
            purchaseReturn: {
              is: {
                status: 'COMPLETED',
              },
            },
          },
          _sum: {
            quantity: true,
          },
        });


      const returnedQuantity =
        Number(returnedResult._sum.quantity || 0);


      if (returnedQuantity > 0) {
        anyReturned = true;
      }


      if (
        returnedQuantity <
        Number(purchaseItem.quantity)
      ) {
        allFullyReturned = false;
      }

    }


    let newStatus = purchase.status;


    if (allFullyReturned) {

      newStatus =
        'FULLY_RETURNED';

    } else if (anyReturned) {

      newStatus =
        'PARTIALLY_RETURNED';

    }


    if (newStatus !== purchase.status) {

      await tx.purchase.update({
        where: {
          id: purchase.id,
        },
        data: {
          status: newStatus,
        },
      });

    }


    /*
     * Update purchase payable after return.
     *
     * totalAmount remains the original purchase invoice total.
     * paidAmount remains the amount actually paid.
     * dueAmount is reduced by the returned amount.
     */
    const currentDueAmount = Number(purchase.dueAmount);

    const newDueAmount = Math.max(
      0,
      currentDueAmount - totalAmount
    );

    let newPaymentStatus = purchase.paymentStatus;

    if (newDueAmount <= 0) {
      newPaymentStatus = 'PAID';
    } else if (newDueAmount < Number(purchase.totalAmount)) {
      newPaymentStatus = 'PARTIAL';
    } else {
      newPaymentStatus = 'UNPAID';
    }

    await tx.purchase.update({
      where: {
        id: purchase.id,
      },
      data: {
        dueAmount: newDueAmount,
        paymentStatus: newPaymentStatus,
      },
    });


    /*
     * Supplier ledger:
     * Purchase return reduces payable.
     */
    await tx.ledgerEntry.create({

      data: {

        storeId,

        supplierId:
          purchase.supplierId,

        ledgerType:
          'SUPPLIER',

        entryType:
          'PURCHASE_RETURN',

        amount:
          -totalAmount,

        referenceId:
          purchaseReturn.id,

        referenceNumber:
          purchaseReturn.returnNumber,

        description:
          `Purchase return ${purchaseReturn.returnNumber}`,

        entryDate:
          new Date(),

      },

    });


    return purchaseReturn;

  });

}


async function getPurchaseReturns(storeId, filters = {}) {
  if (!storeId) {
    throw new Error('Store ID is required');
  }

  const {
    search = '',
    fromDate = null,
    toDate = null,
    supplierId = null,
  } = filters;

  const whereClause = {
    storeId,
  };

  if (supplierId) {
    whereClause.supplierId = supplierId;
  }

  if (fromDate && toDate) {
    whereClause.returnDate = {
      gte: new Date(fromDate),
      lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)),
    };
  }

  if (search) {
    whereClause.OR = [
      { returnNumber: { contains: search, mode: 'insensitive' } },
      { reason: { contains: search, mode: 'insensitive' } },
      { supplier: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const purchaseReturns = await prisma.purchaseReturn.findMany({
    where: whereClause,
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          contactPerson: true,
          phone: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          batch: {
            select: {
              id: true,
              batchNumber: true,
              expiryDate: true,
            },
          },
        },
      },
    },
    orderBy: {
      returnDate: 'desc',
    },
  });

  return purchaseReturns;
}

async function getPurchaseReturnById(storeId, returnId) {
  if (!storeId) {
    throw new Error('Store ID is required');
  }

  if (!returnId) {
    throw new Error('Return ID is required');
  }

  const purchaseReturn = await prisma.purchaseReturn.findFirst({
    where: {
      id: returnId,
      storeId,
    },
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          contactPerson: true,
          phone: true,
          email: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
          batch: {
            select: {
              id: true,
              batchNumber: true,
              expiryDate: true,
            },
          },
        },
      },
    },
  });

  if (!purchaseReturn) {
    throw new Error('Purchase return not found');
  }

  return purchaseReturn;
}

async function cancelPurchaseReturn(storeId, returnId) {
  if (!storeId) {
    throw new Error('Store ID is required');
  }

  if (!returnId) {
    throw new Error('Return ID is required');
  }

  return prisma.$transaction(async (tx) => {
    const purchaseReturn = await tx.purchaseReturn.findFirst({
      where: {
        id: returnId,
        storeId,
      },
      include: {
        items: true,
      },
    });

    if (!purchaseReturn) {
      throw new Error('Purchase return not found');
    }

    if (purchaseReturn.status === 'CANCELLED') {
      throw new Error('This purchase return is already cancelled');
    }

    // Cancel the return
    const cancelledReturn = await tx.purchaseReturn.update({
      where: {
        id: returnId,
      },
      data: {
        status: 'CANCELLED',
      },
    });

    // Restore stock for all items
    for (const item of purchaseReturn.items) {
      const stock = await tx.stock.findFirst({
        where: {
          storeId,
          productId: item.productId,
          batchId: item.batchId,
        },
      });

      if (stock) {
        const quantityBefore = Number(stock.quantity);
        const quantityAfter = quantityBefore + Number(item.baseQuantity);

        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: quantityAfter },
        });

        await tx.stockMovement.create({
          data: {
            storeId,
            productId: item.productId,
            batchId: item.batchId,
            stockId: stock.id,
            type: 'PURCHASE_RETURN',
            referenceType: 'PURCHASE_RETURN',
            quantity: Number(item.baseQuantity),
            quantityBefore,
            quantityAfter,
            unitCost: item.unitPrice,
            referenceId: returnId,
            reason: `Purchase return cancellation ${purchaseReturn.returnNumber}`,
          },
        });
      }
    }

    // Find the original purchase
    if (purchaseReturn.items.length > 0) {
      const firstItem = purchaseReturn.items[0];
      const purchaseItem = await tx.purchaseItem.findFirst({
        where: {
          id: firstItem.purchaseItemId,
        },
      });

      if (purchaseItem) {
        const purchase = await tx.purchase.findUnique({
          where: { id: purchaseItem.purchaseId },
          include: { items: true },
        });

        if (purchase) {
          // Recalculate purchase status
          let allFullyReturned = true;
          let anyReturned = false;

          for (const pItem of purchase.items) {
            const returnedResult = await tx.purchaseReturnItem.aggregate({
              where: {
                purchaseItemId: pItem.id,
                purchaseReturn: {
                  is: {
                    status: 'COMPLETED',
                  },
                },
              },
              _sum: {
                quantity: true,
              },
            });

            const returnedQuantity = Number(returnedResult._sum.quantity || 0);

            if (returnedQuantity > 0) {
              anyReturned = true;
            }

            if (returnedQuantity < Number(pItem.quantity)) {
              allFullyReturned = false;
            }
          }

          let newStatus = purchase.status;

          if (allFullyReturned && anyReturned) {
            newStatus = 'FULLY_RETURNED';
          } else if (anyReturned) {
            newStatus = 'PARTIALLY_RETURNED';
          } else {
            newStatus = 'RECEIVED';
          }

          // Recalculate payment amounts
          const totalReturned = await tx.purchaseReturnItem.aggregate({
            where: {
              purchaseItem: {
                purchaseId: purchase.id,
              },
              purchaseReturn: {
                status: 'COMPLETED',
              },
            },
            _sum: {
              totalAmount: true,
            },
          });

          const returnAmount = Number(totalReturned._sum.totalAmount || 0);
          const newDueAmount = Math.max(0, Number(purchase.dueAmount) + returnAmount);

          let newPaymentStatus = purchase.paymentStatus;

          if (newDueAmount <= 0) {
            newPaymentStatus = 'PAID';
          } else if (newDueAmount < Number(purchase.totalAmount)) {
            newPaymentStatus = 'PARTIAL';
          } else {
            newPaymentStatus = 'UNPAID';
          }

          await tx.purchase.update({
            where: { id: purchase.id },
            data: {
              status: newStatus,
              dueAmount: newDueAmount,
              paymentStatus: newPaymentStatus,
            },
          });
        }
      }
    }

    return cancelledReturn;
  });
}

module.exports = {
  createPurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturnById,
  cancelPurchaseReturn,
};
