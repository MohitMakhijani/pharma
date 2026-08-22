const prisma = require('../config/prisma');

async function getUsers(storeId) {
  return prisma.user.findMany({
    where: {
      storeId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,

      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },

      store: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

module.exports = {
  getUsers,
};

async function getUserById(userId, storeId) {
  return prisma.user.findFirst({
    where: {
      id: userId,
      storeId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,

      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },

      store: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
}

module.exports.getUserById = getUserById;

const { hashPassword } = require('../utils/password');

async function createUser(data, storeId) {
  const {
    name,
    email,
    phone,
    password,
    roleId,
  } = data;

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(phone ? [{ phone }] : []),
      ],
    },
  });

  if (existingUser) {
    const error = new Error('User with this email or phone already exists');
    error.statusCode = 409;
    throw error;
  }

  const role = await prisma.role.findUnique({
    where: {
      id: roleId,
    },
  });

  if (!role) {
    const error = new Error('Invalid role');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await hashPassword(password);

  return prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      roleId,
      storeId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,

      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },

      store: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
}

module.exports.createUser = createUser;

async function updateUser(userId, storeId, data) {
  const {
    name,
    email,
    phone,
    roleId,
    status,
    password,
  } = data;

  const existingUser = await prisma.user.findFirst({
    where: {
      id: userId,
      storeId,
    },
  });

  if (!existingUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (email || phone) {
    const duplicateUser = await prisma.user.findFirst({
      where: {
        storeId,
        id: { not: userId },
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (duplicateUser) {
      const error = new Error(
        'Another user with this email or phone already exists'
      );
      error.statusCode = 409;
      throw error;
    }
  }

  if (roleId) {
    const role = await prisma.role.findUnique({
      where: {
        id: roleId,
      },
    });

    if (!role) {
      const error = new Error('Invalid role');
      error.statusCode = 400;
      throw error;
    }
  }

  const updateData = {};

  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone || null;
  if (roleId !== undefined) updateData.roleId = roleId;
  if (status !== undefined) updateData.status = status;

  if (password) {
    updateData.passwordHash = await hashPassword(password);
  }

  return prisma.user.update({
    where: {
      id: userId,
    },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,

      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },

      store: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
}

module.exports.updateUser = updateUser;
