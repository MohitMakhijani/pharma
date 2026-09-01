require('dotenv').config();

const prisma = require('../src/config/prisma');
const { createPurchase } = require('../src/services/purchase.service');

async function main() {
  const storeId = 'cmta0rkah00019orroe4cal1v';

  const supplier = await prisma.supplier.findFirst({
    where: { storeId },
    select: { id: true, name: true },
  });

  if (!supplier) {
    throw new Error(`No supplier found for store ${storeId}`);
  }

  const productName = `Frontend Sim Product ${Date.now()}`;
  const batchNumber = `SIM-${Date.now()}`;
  const expiryDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2).toISOString();
  const manufacturingDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();

  const purchasePayload = {
    storeId,
    supplierId: supplier.id,
    invoiceNumber: `SIM-${Date.now()}`,
    invoiceDate: new Date().toISOString(),
    notes: 'Simulated frontend custom product purchase',
    status: 'RECEIVED',
    items: [
      {
        productName,
        hsnCode: '30049099',
        dosageForm: 'Tablet',
        description: 'Created via simulate-custom-purchase-creation.js',
        quantity: 10,
        freeQuantity: 0,
        purchasePrice: 45,
        mrp: 55,
        sellingPrice: 52,
        batchNumber,
        manufacturingDate,
        expiryDate,
        discountPercent: 0,
        cgstPercent: 0,
        sgstPercent: 0,
        igstPercent: 0,
      },
    ],
  };

  console.log('Creating simulated purchase with custom product...');
  console.log(JSON.stringify({ productName, batchNumber, supplier: supplier.name, invoiceNumber: purchasePayload.invoiceNumber }, null, 2));

  const purchase = await createPurchase(purchasePayload);

  const createdProduct = await prisma.product.findFirst({
    where: {
      storeId,
      name: { equals: productName, mode: 'insensitive' },
    },
    include: {
      batches: {
        orderBy: { createdAt: 'desc' },
        include: { stocks: true },
      },
      purchaseItems: {
        include: { batch: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const createdBatch = createdProduct?.batches?.[0] || null;

  console.log('\nRESULT SUMMARY');
  console.log(JSON.stringify({
    purchaseId: purchase.id,
    invoiceNumber: purchase.invoiceNumber,
    productId: createdProduct?.id || null,
    productName: createdProduct?.name || null,
    sku: createdProduct?.sku || null,
    batchId: createdBatch?.id || null,
    batchNumber: createdBatch?.batchNumber || null,
    expiryDate: createdBatch?.expiryDate || null,
    stockQuantity: createdBatch?.stocks?.[0]?.quantity || null,
    purchaseItemCount: createdProduct?.purchaseItems?.length || 0,
  }, null, 2));

  if (!createdProduct || !createdBatch) {
    throw new Error('Custom product or batch was not created');
  }
}

main()
  .then(() => {
    console.log('\nSimulation completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nSimulation failed:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch (e) {
      // no-op
    }
  });
