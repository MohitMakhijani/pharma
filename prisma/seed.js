require('dotenv').config();

const prisma = require('../src/config/prisma');
const { hashPassword } = require('../src/utils/password');

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default store
  const store = await prisma.store.upsert({
    where: {
      code: 'MAIN',
    },
    update: {},
    create: {
      name: 'Main Pharmacy',
      code: 'MAIN',
      city: 'Jabalpur',
      state: 'Madhya Pradesh',
      isActive: true,
    },
  });

  // Create admin role
  const adminRole = await prisma.role.upsert({
    where: {
      name: 'ADMIN',
    },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Pharmacy administrator',
    },
  });

  // Create admin user
  const passwordHash = await hashPassword('Admin@12345');

  const admin = await prisma.user.upsert({
    where: {
      email: 'admin@pharmaerp.com',
    },
    update: {},
    create: {
      name: 'Pharmacy Admin',
      email: 'admin@pharmaerp.com',
      passwordHash,
      storeId: store.id,
      roleId: adminRole.id,
    },
  });

  console.log('✅ Store:', store.name);
  console.log('✅ Role:', adminRole.name);
  console.log('✅ Admin:', admin.email);
  console.log('🌱 Seed completed');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
