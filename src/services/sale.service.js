const prisma = require('../config/prisma');
const stockService = require('./stock.service');

async function createSale({
  storeId,
  customerId,
  invoiceNumber,
  invoiceDate,
  discountPercent,
  status,
  items,
  notes,
}) {

  if (!invoiceNumber) {
    throw new Error('Invoice number is required');
  }

  if (!items || !items.length) {
    throw new Error('Sale items are required');
  }


  return prisma.$transaction(async (tx) => {

    let subtotal = 0;
    let totalAmount = 0;


    const saleItemsData = [];


    for (const item of items) {

      const batch = await tx.productBatch.findFirst({
        where: {
          id: item.batchId,
          storeId,
          productId: item.productId,
        },
      });


      if (!batch) {
        throw new Error(
          `Batch not found: ${item.batchId}`
        );
      }

      const packaging = item.packagingId
        ? await tx.productPackaging.findFirst({
            where: { id: item.packagingId, productId: item.productId, isSellable: true },
          })
        : null;
      if (item.packagingId && !packaging) {
        throw new Error('Sale packaging does not belong to this product');
      }
      const quantity = Number(item.quantity);
      const conversion = packaging ? Number(packaging.conversionToBase) : 1;
      const baseQuantity = quantity * conversion;


      const stock = await tx.stock.findFirst({
        where: {
          storeId,
          batchId: item.batchId,
          productId: item.productId,
        },
      });


      if (!stock) {
        throw new Error('Stock not found');
      }


      if (
        Number(stock.quantity) <
        baseQuantity
      ) {
        throw new Error(
          `Insufficient stock for batch ${batch.batchNumber}`
        );
      }


      const amount =
        Number(item.unitPrice) * quantity;


      subtotal += amount;
      totalAmount += amount;


      saleItemsData.push({
        productId: item.productId,
        batchId: item.batchId,
        packagingId: packaging?.id || null,
        quantity,
        baseQuantity,

        unitPrice: item.unitPrice,

        costPrice: batch.purchasePrice,
        costPerBaseUnit: batch.costPerBaseUnit,

        totalAmount: amount,
      });


    }


    const discountRate = Math.max(0, Math.min(100, Number(discountPercent || 0))) / 100;
    const discountAmount = subtotal * discountRate;
    totalAmount = subtotal - discountAmount;

    const saleStatus = status === 'DRAFT' ? 'DRAFT' : 'COMPLETED';
    const sale = await tx.sale.create({
      data: {
        storeId,
        customerId: customerId || null,
        invoiceNumber,
        invoiceDate: invoiceDate
          ? new Date(invoiceDate)
          : new Date(),

        status: saleStatus,

        subtotal,
        discountAmount,
        taxableAmount: totalAmount,
        totalAmount,

        dueAmount: totalAmount,
        paidAmount: 0,

        paymentStatus: 'UNPAID',

        notes: notes || null,
      },
    });



    await tx.saleItem.createMany({
      data: saleItemsData.map(item => ({
        ...item,
        saleId: sale.id,
      })),
    });



    if (saleStatus !== 'DRAFT') for (const item of items) {
      const packaging = item.packagingId
        ? await tx.productPackaging.findFirst({ where: { id: item.packagingId, productId: item.productId, isSellable: true } })
        : null;
      const baseQuantity = Number(item.quantity) * (packaging ? Number(packaging.conversionToBase) : 1);

      await stockService.sellStock(
        item.batchId,
        storeId,
        {
          quantity: baseQuantity,
          referenceId: sale.id,
          reason:
            `Sale ${invoiceNumber}`,
        },
        null
      );

    }



    if (customerId && saleStatus !== 'DRAFT') {

      await tx.ledgerEntry.create({
        data: {
          storeId,
          customerId,

          ledgerType: 'CUSTOMER',
          entryType: 'SALE',

          amount: totalAmount,

          referenceId: sale.id,
          referenceNumber: invoiceNumber,

          description:
            `Sale ${invoiceNumber}`,
        },
      });

    }


    return sale;

  });

}


module.exports = {
  createSale,
};
