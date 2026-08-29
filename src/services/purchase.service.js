const prisma = require('../config/prisma');

async function createPurchase({
  storeId,
  supplierId,
  invoiceNumber,
  invoiceDate,
  items,
  notes,
  status = 'RECEIVED',
  purchaseId = null,
}) {
  if (!storeId) throw new Error('Store ID is required');

  const normalizedStatus = String(status || 'RECEIVED').toUpperCase();
  if (!['RECEIVED', 'DRAFT'].includes(normalizedStatus)) {
    throw new Error('Invalid purchase status');
  }

  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
  const hasAnyDraftDetail =
    normalizedStatus === 'DRAFT' && (
      (supplierId && String(supplierId).trim()) ||
      (invoiceNumber && String(invoiceNumber).trim()) ||
      (invoiceDate && String(invoiceDate).trim()) ||
      (notes && String(notes).trim()) ||
      safeItems.some((item) => item && Object.values(item).some((value) => value !== null && value !== undefined && String(value).trim() !== ''))
    );

  if (normalizedStatus === 'DRAFT' && !hasAnyDraftDetail) {
    throw new Error('At least one draft detail is required');
  }

  let resolvedSupplierId = supplierId && String(supplierId).trim() ? String(supplierId).trim() : null;
  if (!resolvedSupplierId && normalizedStatus === 'DRAFT') {
    const fallbackSupplier = await prisma.supplier.findFirst({
      where: { storeId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    resolvedSupplierId = fallbackSupplier?.id || null;
  }

  if (normalizedStatus !== 'DRAFT' && !resolvedSupplierId) {
    throw new Error('Supplier ID is required');
  }

  if (normalizedStatus === 'DRAFT' && !resolvedSupplierId) {
    const fallbackSupplier = await prisma.supplier.findFirst({
      where: { storeId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!fallbackSupplier) {
      throw new Error('Add at least one supplier before saving a draft');
    }

    resolvedSupplierId = fallbackSupplier.id;
  }

  const resolvedInvoiceNumber = (invoiceNumber && String(invoiceNumber).trim()) || (normalizedStatus === 'DRAFT' ? `DRAFT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null);
  if (normalizedStatus !== 'DRAFT' && !resolvedInvoiceNumber) {
    throw new Error('Invoice number is required');
  }

  const resolvedInvoiceDate = invoiceDate || (normalizedStatus === 'DRAFT' ? new Date().toISOString() : null);
  if (normalizedStatus !== 'DRAFT' && !resolvedInvoiceDate) {
    throw new Error('Invoice date is required');
  }

  if (normalizedStatus !== 'DRAFT' && safeItems.length === 0) {
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

    for (const item of safeItems) {
      const quantity = Number(item.quantity);
      const freeQuantity = Number(item.freeQuantity || 0);
      const purchasePrice = Number(item.purchasePrice);
      const mrp = Number(item.mrp);
      const sellingPrice = Number(item.sellingPrice);

      if (normalizedStatus === 'DRAFT') {
        const hasAnyItemDetail = item.productId || item.batchNumber || item.batchId || item.expiryDate || item.hsnCode || Number(item.quantity || 0) > 0 || Number(item.purchasePrice || 0) > 0 || Number(item.mrp || 0) > 0 || Number(item.sellingPrice || 0) > 0;

        if (!hasAnyItemDetail) {
          continue;
        }
      }

      if (!item.productId) {
        if (normalizedStatus === 'DRAFT') {
          continue;
        }
        throw new Error('Product ID is required');
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        if (normalizedStatus === 'DRAFT') {
          continue;
        }
        throw new Error('Quantity must be greater than 0');
      }

      if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
        if (normalizedStatus === 'DRAFT') {
          continue;
        }
        throw new Error('Invalid purchase price');
      }

      if (!Number.isFinite(mrp) || mrp < 0) {
        if (normalizedStatus === 'DRAFT') {
          continue;
        }
        throw new Error('Invalid MRP');
      }

      if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
        if (normalizedStatus === 'DRAFT') {
          continue;
        }
        throw new Error('Invalid selling price');
      }

      const product = await tx.product.findFirst({
        where: { id: item.productId, storeId },
        select: { id: true },
      });

      if (!product) {
        if (normalizedStatus === 'DRAFT') {
          continue;
        }
        throw new Error('Product does not belong to this store');
      }

      const packaging = item.packagingId
        ? await tx.productPackaging.findFirst({
            where: { id: item.packagingId, productId: item.productId, isPurchaseUnit: true },
          })
        : null;
      if (item.packagingId && !packaging) {
        if (normalizedStatus === 'DRAFT') {
          continue;
        }
        throw new Error('Purchase packaging does not belong to this product');
      }

      const conversion = packaging ? Number(packaging.conversionToBase) : 1;
      let batchId = item.batchId;
      if (!batchId) {
        if (normalizedStatus === 'DRAFT' && (!item.batchNumber || !item.expiryDate)) {
          continue;
        }

        if (!item.batchNumber || !item.expiryDate) {
          throw new Error('Batch number and expiry date are required for a new batch');
        }

        const existingBatch = await tx.productBatch.findFirst({
          where: {
            storeId,
            productId: item.productId,
            batchNumber: item.batchNumber,
          },
          select: { id: true },
        });

        if (existingBatch) {
          batchId = existingBatch.id;
        } else {
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
      const itemDiscount = grossAmount * (discountPercent / 100);
      const itemTaxable = grossAmount - itemDiscount;
      const itemCgst = itemTaxable * (cgstPercent / 100);
      const itemSgst = itemTaxable * (sgstPercent / 100);
      const itemIgst = itemTaxable * (igstPercent / 100);
      const itemTotal = itemTaxable + itemCgst + itemSgst + itemIgst;

      const baseQuantity = packaging
        ? quantity * conversion
        : Number(item.baseQuantity ?? quantity);

      const freeBaseQuantity = packaging
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

    const purchasePayload = {
      storeId,
      supplierId: resolvedSupplierId,
      invoiceNumber: resolvedInvoiceNumber,
      invoiceDate: new Date(resolvedInvoiceDate),
      receivedDate: normalizedStatus === 'RECEIVED' ? new Date() : null,
      status: normalizedStatus,
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
    };

    let purchase;

    if (purchaseId) {
      const existing = await tx.purchase.findFirst({
        where: { id: purchaseId, storeId },
      });

      if (!existing) {
        throw new Error('Purchase draft not found');
      }

      await tx.purchaseItem.deleteMany({ where: { purchaseId: existing.id } });
      purchase = await tx.purchase.update({
        where: { id: existing.id },
        data: purchasePayload,
      });

      await tx.purchaseItem.createMany({
        data: preparedItems.map((item) => ({
          purchaseId: purchase.id,
          productId: item.productId,
          batchId: item.batchId,
          packagingId: item.packagingId,
          quantity: item.quantity,
          baseQuantity: item.baseQuantity,
          freeQuantity: item.freeQuantity,
          freeBaseQuantity: item.freeBaseQuantity,
          purchasePrice: item.purchasePrice,
          mrp: item.mrp,
          sellingPrice: item.sellingPrice,
          discountPercent: item.discountPercent,
          discountAmount: item.discountAmount,
          taxableAmount: item.taxableAmount,
          cgstPercent: item.cgstPercent,
          cgstAmount: item.cgstAmount,
          sgstPercent: item.sgstPercent,
          sgstAmount: item.sgstAmount,
          igstPercent: item.igstPercent,
          igstAmount: item.igstAmount,
          totalAmount: item.totalAmount,
        })),
      });
    } else {
      purchase = await tx.purchase.create({
        data: {
          ...purchasePayload,
          items: {
            create: preparedItems.map((item) => ({
              productId: item.productId,
              batchId: item.batchId,
              packagingId: item.packagingId,
              quantity: item.quantity,
              baseQuantity: item.baseQuantity,
              freeQuantity: item.freeQuantity,
              freeBaseQuantity: item.freeBaseQuantity,
              purchasePrice: item.purchasePrice,
              mrp: item.mrp,
              sellingPrice: item.sellingPrice,
              discountPercent: item.discountPercent,
              discountAmount: item.discountAmount,
              taxableAmount: item.taxableAmount,
              cgstPercent: item.cgstPercent,
              cgstAmount: item.cgstAmount,
              sgstPercent: item.sgstPercent,
              sgstAmount: item.sgstAmount,
              igstPercent: item.igstPercent,
              igstAmount: item.igstAmount,
              totalAmount: item.totalAmount,
            })),
          },
        },
        include: {
          supplier: true,
          items: true,
        },
      });
    }

    if (normalizedStatus !== 'DRAFT') {
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

      await tx.ledgerEntry.create({
        data: {
          storeId,
          supplierId,
          ledgerType: 'SUPPLIER',
          entryType: 'PURCHASE',
          amount: totalAmount,
          referenceId: purchase.id,
          referenceNumber: resolvedInvoiceNumber,
          description: `Purchase ${resolvedInvoiceNumber}`,
          entryDate: new Date(resolvedInvoiceDate),
        },
      });
    }

    return purchase;
  });
}

async function getPurchases(storeId, filters = {}) {
  const purchaseWhere = {
    storeId,
    status: {
      not: 'DRAFT',
    },
  };

  if (filters.search) {
    purchaseWhere.OR = [
      { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
      { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  if (filters.fromDate || filters.toDate) {
    purchaseWhere.invoiceDate = {};
    if (filters.fromDate) purchaseWhere.invoiceDate.gte = new Date(`${filters.fromDate}T00:00:00.000Z`);
    if (filters.toDate) purchaseWhere.invoiceDate.lte = new Date(`${filters.toDate}T23:59:59.999Z`);
  }

  return prisma.purchase.findMany({
    where: purchaseWhere,
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

async function getDraftPurchases(storeId) {
  return prisma.purchase.findMany({
    where: {
      storeId,
      status: 'DRAFT',
    },
    include: {
      supplier: true,
      items: {
        include: {
          product: true,
          batch: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });
}

async function deletePurchase(storeId, purchaseId) {
  const purchase = await prisma.purchase.findFirst({
    where: {
      id: purchaseId,
      storeId,
    },
  });

  if (!purchase) {
    throw new Error('Purchase not found');
  }

  return prisma.purchase.delete({
    where: {
      id: purchaseId,
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
  getDraftPurchases,
  deletePurchase,
  getPurchaseById,
};
