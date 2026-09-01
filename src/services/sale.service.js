const prisma = require('../config/prisma');
const stockService = require('./stock.service');

async function getSales(storeId, filters = {}) {
  const saleWhere = {
    storeId,
  };

  if (filters.status && filters.status !== 'ALL') {
    saleWhere.status = filters.status;
  }

  if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
    saleWhere.paymentStatus = filters.paymentStatus;
  }

  if (filters.search) {
    saleWhere.OR = [
      { invoiceNumber: { contains: filters.search, mode: 'insensitive' } },
      { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
      { customer: { phone: { contains: filters.search, mode: 'insensitive' } } },
      { doctor: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.fromDate || filters.toDate) {
    saleWhere.invoiceDate = {};
    if (filters.fromDate) saleWhere.invoiceDate.gte = new Date(`${filters.fromDate}T00:00:00.000Z`);
    if (filters.toDate) saleWhere.invoiceDate.lte = new Date(`${filters.toDate}T23:59:59.999Z`);
  }

  return prisma.sale.findMany({
    where: saleWhere,
    include: {
      customer: true,
      doctorRel: true,
      items: {
        include: {
          product: true,
          batch: true,
          packaging: true,
        },
      },
      payments: true,
    },
    orderBy: {
      invoiceDate: 'desc',
    },
  });
}

async function getSaleById(storeId, saleId) {
  return prisma.sale.findFirst({
    where: {
      id: saleId,
      storeId,
    },
    include: {
      customer: true,
      doctorRel: true,
      items: {
        include: {
          product: true,
          batch: true,
          packaging: true,
        },
      },
      payments: true,
    },
  });
}

async function createSale({
  storeId,
  customerId,
  customerName = null,
  customerPhone = null,
  doctorId = null,
  doctorName = null,
  invoiceNumber,
  invoiceDate,
  dueDate,
  doctor,
  discountPercent = 0,
  paymentMethod = 'CASH',
  paymentStatus = null,
  paidAmount = 0,
  items = [],
  notes = null,
  prescriptions = [],
  saleId = null,
  status = 'COMPLETED',
}) {
  const safeItems = (Array.isArray(items) ? items : []).filter(Boolean);
  const normalizedStatus = String(status || 'COMPLETED').toUpperCase();

  if (normalizedStatus !== 'DRAFT' && (!safeItems || !safeItems.length)) {
    throw new Error('Sale items are required');
  }

  // If updating existing draft, remove old child items and payment records first
  if (saleId) {
    const existing = await prisma.sale.findFirst({
      where: { id: saleId, storeId },
    });
    if (existing && existing.status === 'DRAFT') {
      await prisma.saleItem.deleteMany({ where: { saleId } });
      await prisma.salePayment.deleteMany({ where: { saleId } });
    }
  }

  const generatedInvoiceNumber = invoiceNumber && String(invoiceNumber).trim()
    ? String(invoiceNumber).trim()
    : `INV-${Date.now()}`;

  // Process and upload any base64 prescription images OUTSIDE transaction so we don't hold the DB connection
  const finalPrescriptionUrls = [];
  const { uploadToCloudinary } = require('../config/cloudinary');

  if (Array.isArray(prescriptions)) {
    for (const item of prescriptions) {
      if (typeof item === 'string' && item.trim()) {
        if (item.startsWith('http://') || item.startsWith('https://')) {
          finalPrescriptionUrls.push(item);
        } else if (item.startsWith('data:')) {
          try {
            const res = await uploadToCloudinary(item, {
              folder: `pharma/${storeId}/prescriptions`,
            });
            finalPrescriptionUrls.push(res.url);
          } catch (err) {
            console.warn('Cloudinary upload warning:', err.message);
            finalPrescriptionUrls.push(item); // fallback to stored data uri
          }
        }
      }
    }
  }

  return prisma.$transaction(
    async (tx) => {
      // If a custom/new customer name was given without existing ID, optionally link or resolve
      let resolvedCustomerId = customerId && String(customerId).trim() ? String(customerId).trim() : null;
      if (!resolvedCustomerId && customerName && String(customerName).trim() && String(customerName).trim().toLowerCase() !== 'cash sale') {
        const existingCustomer = await tx.customer.findFirst({
          where: {
            storeId,
            OR: [
              { name: { equals: customerName.trim(), mode: 'insensitive' } },
              ...(customerPhone ? [{ phone: { equals: customerPhone.trim() } }] : []),
            ],
          },
        });

        if (existingCustomer) {
          resolvedCustomerId = existingCustomer.id;
        } else {
          const newCustomer = await tx.customer.create({
            data: {
              storeId,
              name: customerName.trim(),
              phone: customerPhone ? customerPhone.trim() : null,
            },
          });
          resolvedCustomerId = newCustomer.id;
        }
      }

      // Resolve or auto-create doctor if doctorName is provided
      let resolvedDoctorId = doctorId && String(doctorId).trim() ? String(doctorId).trim() : null;
      let resolvedDoctorText = doctor ? String(doctor).trim() : null;

      if (!resolvedDoctorId && (doctorName || doctor) && String(doctorName || doctor).trim()) {
        const docInput = String(doctorName || doctor).trim();
        const existingDoc = await tx.doctor.findFirst({
          where: {
            storeId,
            name: { equals: docInput, mode: 'insensitive' },
          },
        });

        if (existingDoc) {
          resolvedDoctorId = existingDoc.id;
          resolvedDoctorText = existingDoc.name;
        } else {
          const newDoc = await tx.doctor.create({
            data: {
              storeId,
              name: docInput,
            },
          });
          resolvedDoctorId = newDoc.id;
          resolvedDoctorText = newDoc.name;
        }
      } else if (resolvedDoctorId && !resolvedDoctorText) {
        const existingDoc = await tx.doctor.findUnique({
          where: { id: resolvedDoctorId },
        });
        if (existingDoc) {
          resolvedDoctorText = existingDoc.name;
        }
      }

      let subtotal = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      const saleItemsData = [];

      for (const item of safeItems) {
        if (!item.productId || !item.batchId) {
          if (normalizedStatus === 'DRAFT') continue;
          throw new Error('Product and Batch are required for each sale item');
        }

        const batch = await tx.productBatch.findFirst({
          where: {
            id: item.batchId,
            storeId,
            productId: item.productId,
          },
        });

        if (!batch) {
          throw new Error(`Batch not found: ${item.batchId}`);
        }

        const packaging = item.packagingId
          ? await tx.productPackaging.findFirst({
              where: { id: item.packagingId, productId: item.productId, isSellable: true },
            })
          : null;

        const conversion = packaging ? Math.max(1, Number(packaging.conversionToBase || 1)) : 1;
        const packQty = Number(item.qty || item.quantity || 0);
        const looseQty = Number(item.tabs || item.looseQuantity || 0);
        const totalUnits = (packQty * conversion) + looseQty;

        if (totalUnits <= 0 && normalizedStatus !== 'DRAFT') {
          throw new Error(`Quantity must be greater than 0 for ${item.itemName || 'item'}`);
        }

        // Check available stock
        const stock = await tx.stock.findFirst({
          where: {
            storeId,
            batchId: item.batchId,
            productId: item.productId,
          },
        });

        if (!stock && normalizedStatus !== 'DRAFT') {
          throw new Error(`No stock found for batch ${batch.batchNumber}`);
        }

        if (normalizedStatus !== 'DRAFT' && Number(stock.quantity) < totalUnits) {
          throw new Error(`Insufficient stock for ${item.itemName || batch.batchNumber}. Available: ${stock.quantity}, Requested: ${totalUnits}`);
        }

        const unitPrice = Number(item.unitPrice || item.mrp || batch.sellingPrice || batch.mrp || 0);
        // Unit price for pack vs single loose unit
        const lineGrossAmount = (packQty * unitPrice) + (looseQty * (unitPrice / conversion));
        const lineDiscPercent = Number(item.disc || item.discountPercent || 0);
        const lineDiscAmount = lineGrossAmount * (lineDiscPercent / 100);
        const lineTaxable = lineGrossAmount - lineDiscAmount;

        const lineGstPercent = Number(item.gstPercent || 0);
        const lineCgst = (lineTaxable * (lineGstPercent / 2)) / 100;
        const lineSgst = (lineTaxable * (lineGstPercent / 2)) / 100;
        const lineTotal = lineTaxable + lineCgst + lineSgst;

        subtotal += lineTaxable;
        cgstAmount += lineCgst;
        sgstAmount += lineSgst;

        saleItemsData.push({
          productId: item.productId,
          batchId: item.batchId,
          packagingId: packaging?.id || null,
          quantity: packQty + (looseQty / conversion),
          baseQuantity: totalUnits,
          unitPrice,
          costPrice: batch.purchasePrice,
          costPerBaseUnit: batch.costPerBaseUnit,
          discountPercent: lineDiscPercent,
          discountAmount: lineDiscAmount,
          taxableAmount: lineTaxable,
          cgstPercent: lineGstPercent / 2,
          cgstAmount: lineCgst,
          sgstPercent: lineGstPercent / 2,
          sgstAmount: lineSgst,
          igstPercent: 0,
          igstAmount: 0,
          totalAmount: lineTotal,
        });
      }

      const overallDiscRate = Math.max(0, Math.min(100, Number(discountPercent || 0))) / 100;
      const overallDiscountAmount = subtotal * overallDiscRate;
      const taxableAfterDiscount = subtotal - overallDiscountAmount;
      const grandTotalBeforeRound = taxableAfterDiscount + cgstAmount + sgstAmount;
      const roundOff = Math.round(grandTotalBeforeRound) - grandTotalBeforeRound;
      const finalTotalAmount = Math.round(grandTotalBeforeRound);

      const isCashPayment = String(paymentStatus || '').toUpperCase() === 'PAID' || Number(paidAmount || 0) >= finalTotalAmount;
      const resolvedPaidAmount = normalizedStatus === 'DRAFT'
        ? 0
        : isCashPayment
          ? finalTotalAmount
          : Math.max(0, Number(paidAmount || 0));
      const resolvedDueAmount = Math.max(0, finalTotalAmount - resolvedPaidAmount);
      const resolvedPaymentStatus = normalizedStatus === 'DRAFT'
        ? 'UNPAID'
        : resolvedDueAmount <= 0
          ? 'PAID'
          : resolvedPaidAmount > 0
            ? 'PARTIAL'
            : 'UNPAID';

      let sale;
      const saleData = {
        storeId,
        customerId: resolvedCustomerId,
        doctorId: resolvedDoctorId,
        invoiceNumber: generatedInvoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        doctor: resolvedDoctorText,
        status: normalizedStatus === 'DRAFT' ? 'DRAFT' : 'COMPLETED',
        subtotal,
        discountAmount: overallDiscountAmount,
        taxableAmount: taxableAfterDiscount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        roundOff,
        totalAmount: finalTotalAmount,
        paidAmount: resolvedPaidAmount,
        dueAmount: resolvedDueAmount,
        paymentStatus: resolvedPaymentStatus,
        notes: notes || null,
        prescriptions: finalPrescriptionUrls,
      };

      if (saleId) {
        sale = await tx.sale.update({
          where: { id: saleId },
          data: saleData,
        });
      } else {
        sale = await tx.sale.create({
          data: saleData,
        });
      }

    if (saleItemsData.length > 0) {
      await tx.saleItem.createMany({
        data: saleItemsData.map((item) => ({
          ...item,
          saleId: sale.id,
        })),
      });
    }

    // Deduct stock for completed sales
    if (normalizedStatus !== 'DRAFT') {
      for (const item of saleItemsData) {
        await stockService.sellStock(
          item.batchId,
          storeId,
          {
            quantity: item.baseQuantity,
            referenceId: sale.id,
            reason: `Sale ${generatedInvoiceNumber}`,
          },
          null
        );
      }
    }

    // Customer ledger & payment recording
    if (resolvedCustomerId && normalizedStatus !== 'DRAFT') {
      // 1. Debit customer for the sale total
      await tx.ledgerEntry.create({
        data: {
          storeId,
          customerId: resolvedCustomerId,
          ledgerType: 'CUSTOMER',
          entryType: 'SALE',
          amount: finalTotalAmount,
          referenceId: sale.id,
          referenceNumber: generatedInvoiceNumber,
          description: `Sale ${generatedInvoiceNumber}`,
          entryDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        },
      });

      // 2. If paid amount > 0, credit customer ledger & record sale payment
      if (resolvedPaidAmount > 0) {
        await tx.salePayment.create({
          data: {
            saleId: sale.id,
            amount: resolvedPaidAmount,
            paymentMethod: String(paymentMethod || 'CASH').toUpperCase(),
            notes: notes || `Payment for ${generatedInvoiceNumber}`,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            storeId,
            customerId: resolvedCustomerId,
            ledgerType: 'CUSTOMER',
            entryType: 'SALE_PAYMENT',
            amount: -resolvedPaidAmount,
            referenceId: sale.id,
            referenceNumber: generatedInvoiceNumber,
            description: `Payment for Sale ${generatedInvoiceNumber} (${paymentMethod})`,
            entryDate: new Date(),
          },
        });
      }
    } else if (resolvedPaidAmount > 0 && normalizedStatus !== 'DRAFT') {
      // Direct cash sale payment record
      await tx.salePayment.create({
        data: {
          saleId: sale.id,
          amount: resolvedPaidAmount,
          paymentMethod: String(paymentMethod || 'CASH').toUpperCase(),
          notes: notes || `Cash Sale ${generatedInvoiceNumber}`,
        },
      });
    }

    return sale;
  },
    {
      maxWait: 10000,
      timeout: 30000,
    }
  );
}

async function deleteSale(storeId, saleId) {
  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      storeId,
    },
    include: {
      items: true,
      payments: true,
    },
  });

  if (!sale) {
    throw new Error('Sale not found');
  }

  return prisma.$transaction(async (tx) => {
    // If completed sale with stock deductions, return stock
    if (sale.status === 'COMPLETED') {
      for (const item of sale.items) {
        await stockService.adjustStock(
          item.batchId,
          storeId,
          {
            quantity: Number(item.baseQuantity || 0),
            reason: `Deleted sale ${sale.invoiceNumber}`,
            referenceType: 'SALE',
            referenceId: sale.id,
          }
        );
      }
    }

    // Delete ledger entries and payments
    await tx.ledgerEntry.deleteMany({
      where: {
        storeId,
        referenceId: sale.id,
      },
    });

    await tx.salePayment.deleteMany({
      where: {
        saleId: sale.id,
      },
    });

    await tx.saleItem.deleteMany({
      where: {
        saleId: sale.id,
      },
    });

    if (Array.isArray(sale.prescriptions) && sale.prescriptions.length > 0) {
      const { deleteFromCloudinary } = require('../config/cloudinary');
      for (const imgUrl of sale.prescriptions) {
        if (typeof imgUrl === 'string' && (imgUrl.includes('cloudinary.com') || imgUrl.startsWith('pharma/'))) {
          try {
            await deleteFromCloudinary(imgUrl);
          } catch (err) {
            console.warn('Cloudinary delete warning on sale deletion:', err.message);
          }
        }
      }
    }

    return tx.sale.delete({
      where: {
        id: saleId,
      },
    });
  });
}

module.exports = {
  getSales,
  getSaleById,
  createSale,
  deleteSale,
};
