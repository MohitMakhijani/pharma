const prisma = require('../config/prisma');
const stockService = require('./stock.service');


async function createSalesReturn({
  storeId,
  saleId,
  items,
  reason,
}) {

  if (!items || !items.length) {
    throw new Error('Return items required');
  }


  return prisma.$transaction(async (tx) => {

    const sale = await tx.sale.findFirst({
      where: {
        id: saleId,
        storeId,
      },
      include: {
        items: true,
      }
    });


    if (!sale) {
      throw new Error('Sale not found');
    }


    let totalAmount = 0;
    const returnItems = [];


    /*
     * Track requested quantities by saleItemId.
     *
     * This is important when the same saleItemId appears
     * multiple times in one request.
     */
    const requestedBySaleItem = new Map();


    for (const item of items) {

      const saleItem = sale.items.find(
        x => x.id === item.saleItemId
      );


      if (!saleItem) {
        throw new Error(
          `Sale item not found: ${item.saleItemId}`
        );
      }


      const qty = Number(item.quantity);


      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error('Invalid quantity');
      }


      /*
       * Prevent duplicate/excess quantities within the
       * same request.
       */
      const previousRequested =
        requestedBySaleItem.get(saleItem.id) || 0;

      const requestedTotal =
        previousRequested + qty;

      requestedBySaleItem.set(
        saleItem.id,
        requestedTotal
      );


      /*
       * Find all previously completed returns for this
       * exact SaleItem.
       *
       * This is what prevents cumulative over-return.
       */
      const previousReturns =
        await tx.salesReturnItem.aggregate({
          where: {
            saleItemId: saleItem.id,
            salesReturn: {
              status: 'COMPLETED',
            },
          },
          _sum: {
            quantity: true,
          },
        });


      const alreadyReturned =
        Number(previousReturns._sum.quantity || 0);


      const soldQuantity =
        Number(saleItem.quantity);


      const remainingQuantity =
        soldQuantity -
        alreadyReturned;


      /*
       * Include quantities already requested earlier in
       * this same API request.
       */
      const remainingAfterRequest =
        remainingQuantity -
        requestedTotal;


      if (remainingAfterRequest < 0) {

        throw new Error(
          `Cannot return ${qty} for sale item ${saleItem.id}. ` +
          `Sold: ${soldQuantity}, ` +
          `Already returned: ${alreadyReturned}, ` +
          `Requested in this request: ${requestedTotal}, ` +
          `Remaining: ${Math.max(0, remainingQuantity - previousRequested)}`
        );

      }


      const amount =
        qty * Number(saleItem.unitPrice);


      totalAmount += amount;


      returnItems.push({

        saleItemId: saleItem.id,

        productId: saleItem.productId,

        batchId: saleItem.batchId,

        packagingId:
          saleItem.packagingId || null,

        quantity: qty,

        baseQuantity:
          item.baseQuantity !== undefined &&
          item.baseQuantity !== null
            ? Number(item.baseQuantity)
            : qty,

        unitPrice: saleItem.unitPrice,

        totalAmount: amount,

        reason:
          item.reason || reason || null,

      });

    }


    /*
     * Create the sales return.
     */
    const salesReturn =
      await tx.salesReturn.create({

        data: {

          storeId,

          customerId: sale.customerId,

          saleId: sale.id,

          returnNumber:
            `SR-${Date.now()}`,

          returnDate: new Date(),

          subtotal: totalAmount,

          totalAmount,

          reason: reason || null,

          items: {
            create: returnItems
          }

        }

      });


    /*
     * Add returned stock back into inventory.
     */
    for (const item of returnItems) {

      await stockService.salesReturn(
        item.batchId,
        storeId,
        null,
        {
          quantity: item.baseQuantity,

          referenceId:
            salesReturn.id,

          reason:
            `Sales return ${salesReturn.returnNumber}`
        }
      );

    }


    /*
     * Customer ledger:
     * Sales return is a credit to the customer.
     */
    if (sale.customerId) {

      await tx.ledgerEntry.create({

        data: {

          storeId,

          customerId: sale.customerId,

          ledgerType: 'CUSTOMER',

          entryType: 'SALES_RETURN',

          amount: -totalAmount,

          referenceId:
            salesReturn.id,

          referenceNumber:
            salesReturn.returnNumber,

          description:
            `Sales return ${salesReturn.returnNumber}`

        }

      });

    }


    /*
     * Determine the correct sale status after this return.
     *
     * We calculate returned quantity for every SaleItem,
     * including the newly-created return.
     */
    const allSaleItems =
      await tx.saleItem.findMany({
        where: {
          saleId: sale.id,
        },
        select: {
          id: true,
          quantity: true,
        },
      });


    let fullyReturned = true;


    for (const saleItem of allSaleItems) {

      const returned =
        await tx.salesReturnItem.aggregate({
          where: {
            saleItemId: saleItem.id,
            salesReturn: {
              status: 'COMPLETED',
            },
          },
          _sum: {
            quantity: true,
          },
        });


      const soldQuantity =
        Number(saleItem.quantity);

      const returnedQuantity =
        Number(returned._sum.quantity || 0);


      if (returnedQuantity < soldQuantity) {
        fullyReturned = false;
        break;
      }

    }


    await tx.sale.update({

      where: {
        id: sale.id
      },

      data: {
        status:
          fullyReturned
            ? 'FULLY_RETURNED'
            : 'PARTIALLY_RETURNED'
      }

    });


    return salesReturn;

  });

}


module.exports = {
  createSalesReturn
};
