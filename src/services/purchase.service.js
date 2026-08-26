const prisma = require('../config/prisma');

async function createPurchase({
  storeId,
  supplierId,
  invoiceNumber,
  invoiceDate,
  items,
  notes,
}) {
  if (!storeId) throw new Error('Store ID is required');
  if (!supplierId) throw new Error('Supplier ID is required');
  if (!invoiceNumber) throw new Error('Invoice number is required');
  if (!invoiceDate) throw new Error('Invoice date is required');

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one purchase item is required');
  }

  return prisma.$transaction(async (tx) => {
    let subtotal = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let totalAmount = 0;

    const preparedItems = [];

    for (const item of items) {
      const quantity = Number(item.quantity);
      const freeQuantity = Number(item.freeQuantity || 0);
      const purchasePrice = Number(item.purchasePrice);
      const mrp = Number(item.mrp);
      const sellingPrice = Number(item.sellingPrice);

      if (!item.productId) {
        throw new Error('Product ID is required');
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }

      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        throw new Error('Invalid purchase price');
      }

      if (!Number.isFinite(mrp) || mrp < 0) {
        throw new Error('Invalid MRP');
      }

      if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
        throw new Error('Invalid selling price');
      }

      const product = await tx.product.findFirst({
        where: { id: item.productId, storeId },
        select: { id: true },
      });

      if (!product) {
        throw new Error('Product does not belong to this store');
      }

      const packaging = item.packagingId
        ? await tx.productPackaging.findFirst({
            where: { id: item.packagingId, productId: item.productId, isPurchaseUnit: true },
          })
        : null;
      if (item.packagingId && !packaging) {
        throw new Error('Purchase packaging does not belong to this product');
      }

      const conversion = packaging ? Number(packaging.conversionToBase) : 1;
      let batchId = item.batchId;
      if (!batchId) {
        if (!item.batchNumber || !item.expiryDate) {
          throw new Error('Batch number and expiry date are required for a new batch');
        }

        const batch = await tx.productBatch.create({
          data: {
            storeId,
            productId: item.productId,
            batchNumber: item.batchNumber,
            manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate) : null,
            expiryDate: new Date(item.expiryDate),
            purchasePrice,
            costPerBaseUnit: purchasePrice / conversion,
            mrp,
            sellingPrice,
          },
        });
        batchId = batch.id;
      }

      if (item.hsnCode) {
        await tx.product.update({
          where: { id: item.productId },
          data: { hsnCode: item.hsnCode },
        });
      }

      const discountPercent = Number(item.discountPercent || 0);
      const cgstPercent = Number(item.cgstPercent || 0);
      const sgstPercent = Number(item.sgstPercent || 0);
      const igstPercent = Number(item.igstPercent || 0);

      const grossAmount = quantity * purchasePrice;

      const itemDiscount =
        grossAmount * (discountPercent / 100);

      const itemTaxable =
        grossAmount - itemDiscount;

      const itemCgst =
        itemTaxable * (cgstPercent / 100);

      const itemSgst =
        itemTaxable * (sgstPercent / 100);

      const itemIgst =
        itemTaxable * (igstPercent / 100);

      const itemTotal =
        itemTaxable +
        itemCgst +
        itemSgst +
        itemIgst;

      /*
       * baseQuantity represents stock in the product's
       * base unit. For now quantity and baseQuantity are
       * treated as the same value.
       *
       * Packaging conversion can be added later.
       */
      const baseQuantity = packaging
        ? quantity * conversion
        : Number(item.baseQuantity ?? quantity);

      const freeBaseQuantity =
        packaging
          ? freeQuantity * conversion
          : Number(item.freeBaseQuantity ?? freeQuantity);

      preparedItems.push({
        productId: item.productId,
        batchId,
        packagingId: packaging?.id || null,

        quantity,
        baseQuantity,

        freeQuantity,
        freeBaseQuantity,

        purchasePrice,
        mrp,
        sellingPrice,

        discountPercent,
        discountAmount: itemDiscount,

        taxableAmount: itemTaxable,

        cgstPercent,
        cgstAmount: itemCgst,

        sgstPercent,
        sgstAmount: itemSgst,

        igstPercent,
        igstAmount: itemIgst,

        totalAmount: itemTotal,
      });

      subtotal += grossAmount;
      discountAmount += itemDiscount;
      taxableAmount += itemTaxable;
      cgstAmount += itemCgst;
      sgstAmount += itemSgst;
      igstAmount += itemIgst;
      totalAmount += itemTotal;
    }

    const purchase = await tx.purchase.create({
      data: {
        storeId,
        supplierId,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        receivedDate: new Date(),

        status: 'RECEIVED',
        paymentStatus: 'UNPAID',

        subtotal,
        discountAmount,
        taxableAmount,

        cgstAmount,
        sgstAmount,
        igstAmount,

        otherTaxAmount: 0,
        roundOff: 0,

        totalAmount,
        paidAmount: 0,
        dueAmount: totalAmount,

        notes: notes || null,

        items: {
          create: preparedItems,
        },
      },

      include: {
        supplier: true,
        items: true,
      },
    });

    // A received purchase immediately increases stock for each batch.
    for (const item of preparedItems) {
      const batch = await tx.productBatch.findFirst({
        where: {
          id: item.batchId,
          productId: item.productId,
          storeId,
        },
        select: { id: true, productId: true, costPerBaseUnit: true },
      });

      if (!batch) {
        throw new Error('Product batch does not belong to this store or product');
      }

      const receivedQuantity = item.baseQuantity + item.freeBaseQuantity;
      let stock = await tx.stock.findUnique({
        where: {
          storeId_productId_batchId: {
            storeId,
            productId: item.productId,
            batchId: item.batchId,
          },
        },
      });

      if (!stock) {
        stock = await tx.stock.create({
          data: {
            storeId,
            productId: item.productId,
            batchId: item.batchId,
            quantity: 0,
            reservedQuantity: 0,
          },
        });
      }

      const quantityBefore = Number(stock.quantity);
      const quantityAfter = quantityBefore + receivedQuantity;

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
          type: 'PURCHASE',
          referenceType: 'PURCHASE',
          quantity: receivedQuantity,
          quantityBefore,
          quantityAfter,
          unitCost: item.costPerBaseUnit || batch.costPerBaseUnit,
          referenceId: purchase.id,
          reason: `Purchase ${invoiceNumber}`,
        },
      });
    }

    // Supplier ledger:
    // Purchase creates payable (+)
    await tx.ledgerEntry.create({
      data: {
        storeId,
        supplierId,
        ledgerType: 'SUPPLIER',
        entryType: 'PURCHASE',
        amount: totalAmount,
        referenceId: purchase.id,
        referenceNumber: invoiceNumber,
        description: `Purchase ${invoiceNumber}`,
        entryDate: new Date(invoiceDate),
      },
    });

    return purchase;
  });
}

async function getPurchases(storeId) {
  return prisma.purchase.findMany({
    where: {
      storeId,
    },
    include: {
      supplier: true,
      items: {
        include: {
          product: true,
          batch: true,
        },
      },
      payments: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

async function getPurchaseById(storeId, purchaseId) {
  const purchase = await prisma.purchase.findFirst({
    where: {
      id: purchaseId,
      storeId,
    },
    include: {
      supplier: true,
      items: {
        include: {
          product: true,
          batch: true,
          purchaseReturnItems: {
            where: {
              purchaseReturn: {
                status: 'COMPLETED',
              },
            },
            select: {
              quantity: true,
            },
          },
        },
      },
      payments: true,
    },
  });

  if (!purchase) {
    return null;
  }

  return {
    ...purchase,
    items: purchase.items.map((item) => {
      const returnedQuantity = item.purchaseReturnItems.reduce(
        (sum, returnItem) => sum + Number(returnItem.quantity),
        0
      );

      const netQuantity =
        Number(item.quantity) - returnedQuantity;

      return {
        ...item,
        returnedQuantity,
        netQuantity,
        purchaseReturnItems: undefined,
      };
    }),
  };
}



module.exports = {
  createPurchase,
  getPurchases,
  getPurchaseById,
};
