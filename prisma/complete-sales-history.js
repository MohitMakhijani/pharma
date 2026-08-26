require('dotenv').config();

const prisma = require('../src/config/prisma');

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

async function main() {
  const store = await prisma.store.findUnique({ where: { code: 'MAIN' } });
  if (!store) throw new Error('Main Pharmacy store not found');

  const customers = await prisma.customer.findMany({ where: { storeId: store.id }, orderBy: { id: 'asc' } });
  const products = await prisma.product.findMany({
    where: { storeId: store.id },
    include: { batches: { where: { storeId: store.id }, orderBy: { expiryDate: 'asc' }, take: 1 } },
    orderBy: { id: 'asc' },
  });
  const existingSales = await prisma.sale.count({ where: { storeId: store.id } });
  const targetSales = 180;

  for (let index = existingSales; index < targetSales; index += 1) {
    const customer = index % 5 === 0 ? null : customers[index % customers.length];
    const saleItems = [];
    for (let itemIndex = 0; itemIndex < 6; itemIndex += 1) {
      const product = products[(index * 6 + itemIndex * 7) % products.length];
      const batch = product.batches[0];
      if (!batch) continue;
      const quantity = 1 + (itemIndex % 4);
      const unitPrice = Number(batch.sellingPrice);
      const costPrice = Number(batch.purchasePrice);
      const taxable = quantity * unitPrice;
      const gst = taxable * 0.05;
      saleItems.push({ productId: product.id, batchId: batch.id, quantity, baseQuantity: quantity, unitPrice, costPrice, costPerBaseUnit: costPrice, taxableAmount: taxable, totalAmount: taxable + gst, cgstPercent: 2.5, cgstAmount: gst / 2, sgstPercent: 2.5, sgstAmount: gst / 2 });
    }
    const subtotal = saleItems.reduce((sum, item) => sum + item.taxableAmount, 0);
    const total = saleItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const paid = index % 4 === 0 ? total / 2 : total;
    const invoiceNumber = `SAL-REAL-${String(index + 1).padStart(4, '0')}`;
    const sale = await prisma.sale.create({ data: { storeId: store.id, customerId: customer?.id, invoiceNumber, invoiceDate: daysAgo(120 - (index % 120)), subtotal, taxableAmount: subtotal, cgstAmount: (total - subtotal) / 2, sgstAmount: (total - subtotal) / 2, totalAmount: total, paidAmount: paid, dueAmount: total - paid, paymentStatus: paid === total ? 'PAID' : 'PARTIAL' }, select: { id: true } });
    await prisma.saleItem.createMany({ data: saleItems.map((item) => ({ ...item, saleId: sale.id })) });
    if (paid > 0) await prisma.salePayment.create({ data: { saleId: sale.id, amount: paid, paymentMethod: index % 2 ? 'CASH' : 'UPI', paymentDate: daysAgo(119 - (index % 120)) } });
    if (customer) {
      await prisma.ledgerEntry.createMany({ data: [
        { storeId: store.id, ledgerType: 'CUSTOMER', customerId: customer.id, entryType: 'SALE', amount: total, referenceId: sale.id, referenceNumber: invoiceNumber, description: 'Seeded customer sale', entryDate: daysAgo(120 - (index % 120)) },
        { storeId: store.id, ledgerType: 'CUSTOMER', customerId: customer.id, entryType: 'SALE_PAYMENT', amount: -paid, referenceId: sale.id, referenceNumber: invoiceNumber, description: 'Seeded customer collection', entryDate: daysAgo(119 - (index % 120)) },
      ] });
    }
  }
  console.log(`Sales history complete: ${await prisma.sale.count({ where: { storeId: store.id } })} sales`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
