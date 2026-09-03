const prisma = require('../config/prisma');

function inferPackagingDetails(packingString, fallbackDosageForm = null) {
  const raw = String(packingString || '').trim();
  const lower = raw.toLowerCase();

  let conversion = 1;
  let dosageForm = fallbackDosageForm || 'Tablet';

  // Infer Multiplier / Conversion to base units
  // Check patterns like 1x10, 1*10, 10x10, 1x15, 1x30, 10's, etc.
  const multiplierMatch = lower.match(/^(\d+)\s*[x*×]\s*(\d+)$/i);
  if (multiplierMatch) {
    const p1 = Number(multiplierMatch[1]);
    const p2 = Number(multiplierMatch[2]);
    conversion = (p1 > 0 && p2 > 0) ? (p1 * p2) : (p2 || p1 || 1);
  } else {
    const singleMultiplier = lower.match(/^(\d+)\s*['s|s|tab|caps]?$/i);
    if (singleMultiplier && Number(singleMultiplier[1]) > 0 && Number(singleMultiplier[1]) <= 1000) {
      conversion = Number(singleMultiplier[1]);
    }
  }

  // Infer Dosage Form
  if (
    lower.includes('vial') ||
    lower.includes('ampoule') ||
    lower.includes('pfs') ||
    lower.includes('syringe') ||
    lower.includes('iv bag') ||
    lower.includes('injection') ||
    lower.endsWith('ml')
  ) {
    if (lower.includes('syrup') || lower.includes('suspension') || lower.includes('liquid') || lower.includes('bottle')) {
      dosageForm = 'Liquid';
      conversion = 1;
    } else if (lower.includes('drop')) {
      dosageForm = 'Drops';
      conversion = 1;
    } else {
      dosageForm = 'Injection';
      conversion = 1;
    }
  } else if (
    lower.includes('lami tube') ||
    lower.includes('tube') ||
    lower.includes('ointment') ||
    lower.includes('cream') ||
    lower.includes('gel') ||
    lower.endsWith('gm')
  ) {
    dosageForm = lower.includes('gel') ? 'Gel' : 'Cream';
    conversion = 1;
  } else if (lower.includes('inhaler') || lower.includes('rotacap')) {
    dosageForm = 'Inhaler';
    conversion = 1;
  } else if (lower.includes('suppository')) {
    dosageForm = 'Suppository';
  } else if (lower.includes('capsule') || lower.includes('cap')) {
    dosageForm = 'Capsule';
    if (conversion === 1 && (lower.includes('strip') || lower.includes('blister'))) conversion = 10;
  } else if (lower.includes('strip') || lower.includes('blister') || lower.includes('alu') || lower.includes('tablet') || lower.includes('tab') || /\d+\s*[x*×]\s*\d+/i.test(lower)) {
    dosageForm = 'Tablet';
    if (conversion === 1 && (lower.includes('strip') || lower.includes('blister') || lower.includes('alu'))) conversion = 10;
  } else if (lower.includes('bar')) {
    dosageForm = 'Bar';
    conversion = 1;
  }

  if (fallbackDosageForm) {
    dosageForm = fallbackDosageForm;
  }

  return {
    name: raw || (conversion > 1 ? `1x${conversion}` : '1x1'),
    conversionToBase: conversion,
    dosageForm,
  };
}

async function ensureUniquePurchaseInvoiceNumber(tx, storeId, candidate, currentPurchaseId = null) {
  const baseInvoice = (candidate && String(candidate).trim()) || `PO-${Date.now()}`;
  let invoiceNumber = baseInvoice;
  let counter = 1;

  while (true) {
    const existingPurchase = await tx.purchase.findFirst({
      where: {
        storeId,
        invoiceNumber,
        ...(currentPurchaseId ? { id: { not: currentPurchaseId } } : {}),
      },
      select: { id: true },
    });

    if (!existingPurchase) return invoiceNumber;

    const suffix = `-${Date.now()}-${counter}`;
    invoiceNumber = `${baseInvoice}${suffix}`.slice(0, 80);
    counter += 1;
  }
}

async function createPurchase({
  storeId,
  supplierId,
  invoiceNumber,
  invoiceDate,
  dueDate,
  paymentMethod = 'CASH',
  paymentStatus = null,
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
    const uniqueInvoiceNumber = await ensureUniquePurchaseInvoiceNumber(tx, storeId, resolvedInvoiceNumber, purchaseId);

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

        const productName = String(item.productName || '').trim().replace(/\s+/g, ' ');
        if (!productName) {
          throw new Error('Product ID or product name is required');
        }

        // Existing product: use productId if it is already in the store.
        // Custom product: no productId, so backend checks by name and creates a real Product row.
        let autoProduct = await tx.product.findFirst({
          where: {
            storeId,
            name: { equals: productName, mode: 'insensitive' },
          },
          select: { id: true, name: true },
        });

        const packagingInfo = inferPackagingDetails(item.packing || item.packagingName, item.dosageForm);

        if (!autoProduct) {
          const gstPercent = Number(item.cgstPercent || 0) + Number(item.sgstPercent || 0);

          const defaultUnit = await tx.unit.findFirst({
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          });

          if (!defaultUnit) {
            throw new Error('Please add a unit in Products setup before creating purchases');
          }

          const skuBase = productName.replace(/\s+/g, '-').toLowerCase().slice(0, 20);
          const existingSKUs = await tx.product.findMany({
            where: {
              storeId,
              sku: { startsWith: skuBase },
            },
            select: { sku: true },
          });

          const skuNumber = existingSKUs.length + 1;
          const sku = `${skuBase}-${skuNumber}`;

          autoProduct = await tx.product.create({
            data: {
              storeId,
              name: productName,
              sku,
              hsnCode: item.hsnCode ? String(item.hsnCode).trim() : null,
              gstPercent: gstPercent > 0 ? gstPercent : 12,
              baseUnitId: defaultUnit.id,
              status: 'ACTIVE',
              prescriptionOnly: false,
              dosageForm: packagingInfo.dosageForm,
              description: item.description || null,
              minimumStock: 0,
              reorderLevel: 0,
            },
          });

          // Automatically create default packaging with inferred multiplier
          const createdPackaging = await tx.productPackaging.create({
            data: {
              productId: autoProduct.id,
              name: packagingInfo.name,
              unitId: defaultUnit.id,
              conversionToBase: packagingInfo.conversionToBase,
              isSellable: true,
              isPurchaseUnit: true,
              isDefault: true,
              sellingPrice: Number(item.sellingPrice || item.mrp || 0),
              mrp: Number(item.mrp || 0),
            },
          });

          item.packagingId = createdPackaging.id;
        }

        item.productId = autoProduct.id;
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
        select: { id: true, dosageForm: true, baseUnitId: true },
      });

      if (!product) {
        if (normalizedStatus === 'DRAFT') {
          continue;
        }
        throw new Error('Product does not belong to this store');
      }

      // If product exists and has packing specified in purchase, ensure productPackaging exists
      let packaging = item.packagingId
        ? await tx.productPackaging.findFirst({
            where: { id: item.packagingId, productId: item.productId, isPurchaseUnit: true },
          })
        : null;

      if (!packaging && (item.packing || item.packagingName)) {
        const packagingInfo = inferPackagingDetails(item.packing || item.packagingName, product.dosageForm);
        packaging = await tx.productPackaging.findFirst({
          where: { productId: item.productId, name: packagingInfo.name },
        });

        if (!packaging) {
          packaging = await tx.productPackaging.create({
            data: {
              productId: item.productId,
              name: packagingInfo.name,
              unitId: product.baseUnitId,
              conversionToBase: packagingInfo.conversionToBase,
              isSellable: true,
              isPurchaseUnit: true,
              isDefault: false,
              sellingPrice: Number(item.sellingPrice || item.mrp || 0),
              mrp: Number(item.mrp || 0),
            },
          });
        }
        item.packagingId = packaging.id;
      }
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

      // Automatically link Supplier to Product and ProductBatch
      if (supplierId && item.productId) {
        const existingProductSupplier = await tx.productSupplier.findUnique({
          where: {
            productId_supplierId: {
              productId: item.productId,
              supplierId,
            },
          },
        });

        if (!existingProductSupplier) {
          await tx.productSupplier.create({
            data: {
              productId: item.productId,
              supplierId,
              productBatchId: batchId || null,
              purchasePrice: Number(item.purchasePrice || 0),
              isPreferred: true,
              isActive: true,
            },
          });
        } else if (batchId && !existingProductSupplier.productBatchId) {
          await tx.productSupplier.update({
            where: { id: existingProductSupplier.id },
            data: { productBatchId: batchId, purchasePrice: Number(item.purchasePrice || 0) },
          });
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

    const normalizedPaymentMethod = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'].includes(String(paymentMethod || '').toUpperCase())
      ? String(paymentMethod).toUpperCase()
      : 'CASH';

    const isFullCashPayment = String(paymentStatus || '').toUpperCase() === 'PAID' || String(paymentMethod || '').toUpperCase() === 'CASH' && String(paymentStatus || '').toUpperCase() !== 'UNPAID';
    const computedPaymentStatus = String(paymentStatus || '').toUpperCase() === 'PAID' ? 'PAID' : 'UNPAID';
    const initialPaidAmount = computedPaymentStatus === 'PAID' ? totalAmount : 0;
    const initialDueAmount = computedPaymentStatus === 'PAID' ? 0 : totalAmount;

    const purchasePayload = {
      storeId,
      supplierId: resolvedSupplierId,
      invoiceNumber: uniqueInvoiceNumber,
      invoiceDate: new Date(resolvedInvoiceDate),
      dueDate: dueDate ? new Date(dueDate) : null,
      receivedDate: normalizedStatus === 'RECEIVED' ? new Date() : null,
      status: normalizedStatus,
      paymentStatus: computedPaymentStatus,
      paymentMethod: normalizedPaymentMethod,
      subtotal,
      discountAmount,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount,
      otherTaxAmount: 0,
      roundOff: 0,
      totalAmount,
      paidAmount: initialPaidAmount,
      dueAmount: initialDueAmount,
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
            reason: `Purchase ${uniqueInvoiceNumber}`,
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
          referenceNumber: uniqueInvoiceNumber,
          description: `Purchase ${uniqueInvoiceNumber}`,
          entryDate: new Date(resolvedInvoiceDate),
        },
      });

      if (computedPaymentStatus === 'PAID' && totalAmount > 0) {
        await tx.purchasePayment.create({
          data: {
            purchaseId: purchase.id,
            amount: totalAmount,
            paymentMethod: normalizedPaymentMethod,
            notes: `Paid via ${normalizedPaymentMethod}`,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            storeId,
            supplierId,
            ledgerType: 'SUPPLIER',
            entryType: 'PURCHASE_PAYMENT',
            amount: -totalAmount,
            referenceId: purchase.id,
            referenceNumber: uniqueInvoiceNumber,
            description: `Payment for Purchase ${uniqueInvoiceNumber} (${normalizedPaymentMethod})`,
            entryDate: new Date(),
          },
        });
      }
    }

    return purchase;
  });
}

async function getPurchases(storeId, filters = {}) {
  const purchaseWhere = {
    storeId,
    isDeleted: false,
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
      isDeleted: false,
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
      isDeleted: false,
    },
  });

  if (!purchase) {
    throw new Error('Purchase not found');
  }

  return prisma.purchase.update({
    where: {
      id: purchaseId,
    },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  });
}

async function getPurchaseById(storeId, purchaseId) {
  const purchase = await prisma.purchase.findFirst({
    where: {
      id: purchaseId,
      storeId,
      isDeleted: false,
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
