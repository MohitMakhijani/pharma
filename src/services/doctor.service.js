const prisma = require('../config/prisma');

async function getDoctors(storeId, filters = {}) {
  const where = {
    storeId,
  };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search, mode: 'insensitive' } },
      { registrationNo: { contains: filters.search, mode: 'insensitive' } },
      { specialization: { contains: filters.search, mode: 'insensitive' } },
      { hospital: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.isActive !== undefined) {
    where.isActive = String(filters.isActive) === 'true';
  }

  return prisma.doctor.findMany({
    where,
    include: {
      _count: {
        select: {
          sales: true,
          prescriptions: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

async function getDoctorById(id, storeId) {
  return prisma.doctor.findFirst({
    where: {
      id,
      storeId,
    },
    include: {
      sales: {
        take: 20,
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: true,
        },
      },
      prescriptions: {
        take: 20,
        orderBy: { prescriptionDate: 'desc' },
        include: {
          customer: true,
        },
      },
      _count: {
        select: {
          sales: true,
          prescriptions: true,
        },
      },
    },
  });
}

async function createDoctor(data, storeId) {
  if (!data.name || !String(data.name).trim()) {
    throw new Error('Doctor name is required');
  }

  return prisma.doctor.create({
    data: {
      storeId,
      name: String(data.name).trim(),
      phone: data.phone ? String(data.phone).trim() : null,
      email: data.email ? String(data.email).trim() : null,
      specialization: data.specialization ? String(data.specialization).trim() : null,
      registrationNo: data.registrationNo ? String(data.registrationNo).trim() : null,
      hospital: data.hospital ? String(data.hospital).trim() : null,
      address: data.address ? String(data.address).trim() : null,
      notes: data.notes ? String(data.notes).trim() : null,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
    },
  });
}

async function updateDoctor(id, data, storeId) {
  const existing = await prisma.doctor.findFirst({
    where: { id, storeId },
  });

  if (!existing) {
    throw new Error('Doctor not found');
  }

  return prisma.doctor.update({
    where: { id },
    data: {
      name: data.name !== undefined ? String(data.name).trim() : existing.name,
      phone: data.phone !== undefined ? (data.phone ? String(data.phone).trim() : null) : existing.phone,
      email: data.email !== undefined ? (data.email ? String(data.email).trim() : null) : existing.email,
      specialization: data.specialization !== undefined ? (data.specialization ? String(data.specialization).trim() : null) : existing.specialization,
      registrationNo: data.registrationNo !== undefined ? (data.registrationNo ? String(data.registrationNo).trim() : null) : existing.registrationNo,
      hospital: data.hospital !== undefined ? (data.hospital ? String(data.hospital).trim() : null) : existing.hospital,
      address: data.address !== undefined ? (data.address ? String(data.address).trim() : null) : existing.address,
      notes: data.notes !== undefined ? (data.notes ? String(data.notes).trim() : null) : existing.notes,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
    },
  });
}

async function deleteDoctor(id, storeId) {
  const existing = await prisma.doctor.findFirst({
    where: { id, storeId },
  });

  if (!existing) {
    throw new Error('Doctor not found');
  }

  return prisma.doctor.delete({
    where: { id },
  });
}

module.exports = {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  deleteDoctor,
};
