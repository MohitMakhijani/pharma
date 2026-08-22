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
    };
  });

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

module.exports = {
  getCustomerLedger,
};
