const prisma = require('../config/prisma');

async function getBillingNotes(storeId, filters = {}) {
  const { search, category } = filters;

  const where = {
    storeId,
    type: 'BILLING_NOTE',
  };

  if (search && search.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { message: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const notes = await prisma.notification.findMany({
    where,
    orderBy: {
      createdAt: 'desc',
    },
  });

  return notes.map((n) => {
    let parsedData = {};
    try {
      if (n.message && n.message.startsWith('{')) {
        parsedData = JSON.parse(n.message);
      }
    } catch {
      parsedData = { text: n.message };
    }

    return {
      id: n.id,
      title: n.title,
      text: parsedData.text || n.message,
      category: parsedData.category || 'GENERAL', // 'GENERAL', 'ALERT', 'DISCOUNT_RULE', 'PRESCRIPTION_MANDATORY'
      drugOrSalt: parsedData.drugOrSalt || '',
      isImportant: parsedData.isImportant || false,
      createdAt: n.createdAt,
    };
  });
}

async function createBillingNote(storeId, data) {
  const { title, text, category = 'GENERAL', drugOrSalt = '', isImportant = false } = data;

  if (!title || !text) {
    throw new Error('Title and note content are required');
  }

  const payload = JSON.stringify({
    text,
    category,
    drugOrSalt,
    isImportant,
  });

  const note = await prisma.notification.create({
    data: {
      storeId,
      type: 'BILLING_NOTE',
      title,
      message: payload,
    },
  });

  return {
    id: note.id,
    title: note.title,
    text,
    category,
    drugOrSalt,
    isImportant,
    createdAt: note.createdAt,
  };
}

async function deleteBillingNote(storeId, noteId) {
  return prisma.notification.deleteMany({
    where: {
      id: noteId,
      storeId,
      type: 'BILLING_NOTE',
    },
  });
}

module.exports = {
  getBillingNotes,
  createBillingNote,
  deleteBillingNote,
};
