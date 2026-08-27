const prisma = require('../config/prisma');

async function getCustomerLedger(customerId, storeId) {
  const customer = await prisma.customer.findFirst({
    where: {
      id: customerId,
      storeId,
    },
  });

  if (!customer) {
    const error = new Error('Customer not found');
    error.statusCode = 404;
    throw error;
  }

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      storeId,
      customerId,
      ledgerType: 'CUSTOMER',
    },
    orderBy: [
      { entryDate: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  let balance = Number(customer.openingBalance || 0);

  const formattedEntries = entries.map((entry) => {
    const amount = Number(entry.amount);

    balance += amount;

    return {
      id: entry.id,
      entryType: entry.entryType,
      amount,
      referenceId: entry.referenceId,
      referenceNumber: entry.referenceNumber,
      description: entry.description,
      entryDate: entry.entryDate,

      debit: amount > 0 ? amount : 0,
      credit: amount < 0 ? Math.abs(amount) : 0,

      balance,
      paymentMethod: null,
    };
  });

  const paymentIds = formattedEntries.filter((entry) => entry.entryType === 'SALE_PAYMENT').map((entry) => entry.referenceId).filter(Boolean);
  if (paymentIds.length) {
    const payments = await prisma.payment.findMany({ where: { id: { in: paymentIds }, customerId, storeId }, select: { id: true, paymentMethod: true } });
    const paymentMethods = new Map(payments.map((payment) => [payment.id, payment.paymentMethod]));
    formattedEntries.forEach((entry) => { entry.paymentMethod = paymentMethods.get(entry.referenceId) || null; });
  }

  const totalDebit = formattedEntries.reduce(
    (sum, entry) => sum + entry.debit,
    0
  );

  const totalCredit = formattedEntries.reduce(
    (sum, entry) => sum + entry.credit,
    0
  );

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      openingBalance: Number(customer.openingBalance || 0),
    },

    entries: formattedEntries,

    summary: {
      totalDebit,
      totalCredit,
      balance,
    },
  };
}

async function addCustomerPayment({ customerId, storeId, amount, paymentMethod, referenceNumber, notes }) {
  const paymentAmount = Number(amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('Payment amount must be greater than 0');
  if (!paymentMethod) throw new Error('Payment method is required');
  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId }, select: { id: true, name: true } });
  if (!customer) { const error = new Error('Customer not found'); error.statusCode = 404; throw error; }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({ data: { storeId, customerId, amount: paymentAmount, paymentMethod, referenceNumber: referenceNumber || null, notes: notes || null } });
    await tx.ledgerEntry.create({ data: { storeId, customerId, ledgerType: 'CUSTOMER', entryType: 'SALE_PAYMENT', amount: -paymentAmount, referenceId: payment.id, referenceNumber: referenceNumber || null, description: `Payment received from ${customer.name}` } });
    return payment;
  });
}

module.exports = {
  getCustomerLedger,
  addCustomerPayment,
};
