const prisma = require('../config/prisma');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');

async function registerUser({
  name,
  email,
  phone,
  password,
  storeId,
  roleId,
}) {
  if (!name || !password || !storeId || !roleId) {
    throw new Error('name, password, storeId and roleId are required');
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        email ? { email } : undefined,
        phone ? { phone } : undefined,
      ].filter(Boolean),
    },
  });

  if (existingUser) {
    throw new Error('User with this email or phone already exists');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email: email || null,
      phone: phone || null,
      passwordHash,
      storeId,
      roleId,
    },
    include: {
      role: true,
      store: true,
    },
  });

  const token = generateToken({
    userId: user.id,
    storeId: user.storeId,
    roleId: user.roleId,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      role: user.role,
      store: user.store,
    },
    token,
  };
}

async function loginUser({ email, phone, password }) {
  if ((!email && !phone) || !password) {
    throw new Error('Email or phone and password are required');
  }

  const user = await prisma.user.findFirst({
    where: email
      ? { email }
      : { phone },
    include: {
      role: true,
      store: true,
    },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error('User account is not active');
  }

  const validPassword = await comparePassword(
    password,
    user.passwordHash
  );

  if (!validPassword) {
    throw new Error('Invalid credentials');
  }

  const token = generateToken({
    userId: user.id,
    storeId: user.storeId,
    roleId: user.roleId,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      role: user.role,
      store: user.store,
    },
    token,
  };
}

module.exports = {
  registerUser,
  loginUser,
};

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: {
      role: true,
      store: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    role: user.role,
    store: user.store,
  };
}

module.exports.getCurrentUser = getCurrentUser;
