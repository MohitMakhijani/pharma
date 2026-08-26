require('dotenv').config();

const prisma = require('../src/config/prisma');

async function main() {
  const store = await prisma.store.findUnique({ where: { code: 'MAIN' } });
  if (!store) throw new Error('Main Pharmacy store not found');

  const stocks = await prisma.stock.findMany({ where: { storeId: store.id }, orderBy: { productId: 'asc' } });
  const existingMovementCount = await prisma.stockMovement.count({ where: { storeId: store.id } });
  if (!existingMovementCount) {
    await prisma.stockMovement.createMany({ data: stocks.map((stock, index) => ({
      storeId: store.id,
      productId: stock.productId,
      batchId: stock.batchId,
      stockId: stock.id,
      type: 'OPENING_STOCK',
      referenceType: 'MANUAL',
      quantity: Number(stock.quantity),
      quantityBefore: 0,
      quantityAfter: Number(stock.quantity),
      unitCost: 12 + (index % 95),
      reason: 'Opening stock seeded',
    })) });
  }

  const existingPaymentCount = await prisma.payment.count({ where: { storeId: store.id } });
  if (!existingPaymentCount) {
    const suppliers = await prisma.supplier.findMany({ where: { storeId: store.id }, orderBy: { id: 'asc' }, take: 6 });
    const customers = await prisma.customer.findMany({ where: { storeId: store.id }, orderBy: { id: 'asc' }, take: 6 });
    await prisma.payment.createMany({ data: [
      ...suppliers.map((supplier, index) => ({ storeId: store.id, supplierId: supplier.id, amount: 5000 + index * 750, paymentMethod: index % 2 ? 'BANK_TRANSFER' : 'UPI', notes: 'Seeded supplier settlement' })),
      ...customers.map((customer, index) => ({ storeId: store.id, customerId: customer.id, amount: 2500 + index * 450, paymentMethod: index % 2 ? 'CASH' : 'UPI', notes: 'Seeded customer collection' })),
    ] });
  }

  console.log({
    stockMovements: await prisma.stockMovement.count({ where: { storeId: store.id } }),
    payments: await prisma.payment.count({ where: { storeId: store.id } }),
  });
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
