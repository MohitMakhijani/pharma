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
  const tabletUnit = await prisma.unit.upsert({ where: { name: 'Tablet' }, update: {}, create: { name: 'Tablet', symbol: 'tab', type: 'COUNT' } });
  const capsuleUnit = await prisma.unit.upsert({ where: { name: 'Capsule' }, update: {}, create: { name: 'Capsule', symbol: 'cap', type: 'COUNT' } });
  const categories = {};
  for (const name of ['Analgesic', 'Antibiotic', 'Diabetes']) categories[name] = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  const manufacturers = {};
  for (const name of ['Harbor Labs', 'Curewell Pharma', 'Northstar Healthcare']) manufacturers[name] = await prisma.manufacturer.upsert({ where: { name }, update: {}, create: { name } });
  const supplier = await prisma.supplier.upsert({ where: { id: 'demo-supplier-northstar' }, update: {}, create: { id: 'demo-supplier-northstar', storeId: store.id, name: 'Northstar Pharma Ltd.', contactPerson: 'Amina Yusuf', phone: '9876500001', email: 'orders@northstar.example', city: 'Jabalpur', state: 'Madhya Pradesh', creditLimit: 250000, creditDays: 30 } });
  await prisma.supplier.upsert({ where: { id: 'demo-supplier-medline' }, update: {}, create: { id: 'demo-supplier-medline', storeId: store.id, name: 'Medline Distribution', contactPerson: 'David Chen', phone: '9876500002', email: 'sales@medline.example', city: 'Bhopal', state: 'Madhya Pradesh', creditLimit: 150000, creditDays: 15 } });
  await prisma.customer.upsert({ where: { id: 'demo-customer-cedar' }, update: {}, create: { id: 'demo-customer-cedar', storeId: store.id, name: 'Cedar Grove Clinic', phone: '9876510001', email: 'clinic@cedargrove.example', city: 'Jabalpur', creditLimit: 100000, creditDays: 30 } });
  await prisma.customer.upsert({ where: { id: 'demo-customer-westside' }, update: {}, create: { id: 'demo-customer-westside', storeId: store.id, name: 'Westside Pharmacy', phone: '9876510002', email: 'orders@westside.example', city: 'Jabalpur', creditLimit: 75000, creditDays: 15 } });
  const products = [
    { id: 'demo-product-paracetamol', name: 'Paracetamol 500mg', sku: 'PAR-500-TAB', genericName: 'Paracetamol', category: categories.Analgesic, manufacturer: manufacturers['Harbor Labs'], unit: tabletUnit, batch: 'PAR-0826', purchase: 45, mrp: 70, selling: 63, stock: 480 },
    { id: 'demo-product-amoxicillin', name: 'Amoxicillin 500mg', sku: 'AMX-500-CAP', genericName: 'Amoxicillin', category: categories.Antibiotic, manufacturer: manufacturers['Curewell Pharma'], unit: capsuleUnit, batch: 'AMX-0726', purchase: 72, mrp: 110, selling: 99, stock: 220 },
    { id: 'demo-product-metformin', name: 'Metformin 850mg', sku: 'MET-850-TAB', genericName: 'Metformin', category: categories.Diabetes, manufacturer: manufacturers['Northstar Healthcare'], unit: tabletUnit, batch: 'MET-0626', purchase: 38, mrp: 60, selling: 54, stock: 96 },
  ];
  for (const item of products) {
    const product = await prisma.product.upsert({ where: { id: item.id }, update: { categoryId: item.category.id, manufacturerId: item.manufacturer.id, baseUnitId: item.unit.id, strengthUnitId: item.unit.id }, create: { id: item.id, storeId: store.id, name: item.name, sku: item.sku, genericName: item.genericName, dosageForm: item.unit.name, strength: 500, categoryId: item.category.id, manufacturerId: item.manufacturer.id, baseUnitId: item.unit.id, strengthUnitId: item.unit.id, gstPercent: 5, minimumStock: 100, reorderLevel: 150 } });
    const batch = await prisma.productBatch.upsert({ where: { id: `${item.id}-batch` }, update: {}, create: { id: `${item.id}-batch`, storeId: store.id, productId: product.id, batchNumber: item.batch, manufacturingDate: new Date('2026-01-01'), expiryDate: new Date('2027-12-31'), purchasePrice: item.purchase, costPerBaseUnit: item.purchase, mrp: item.mrp, sellingPrice: item.selling } });
    await prisma.productPackaging.upsert({ where: { productId_name: { productId: product.id, name: item.unit.name } }, update: { conversionToBase: 1, isSellable: true, isPurchaseUnit: true, sellingPrice: item.selling, mrp: item.mrp }, create: { productId: product.id, name: item.unit.name, unitId: item.unit.id, conversionToBase: 1, isSellable: true, isPurchaseUnit: true, sellingPrice: item.selling, mrp: item.mrp, isDefault: true } });
    await prisma.productPackaging.upsert({ where: { productId_name: { productId: product.id, name: item.unit.name === 'Capsule' ? 'Box of 10 capsules' : 'Strip of 10 tablets' } }, update: { conversionToBase: 10, isSellable: false, isPurchaseUnit: true, sellingPrice: item.selling * 10, mrp: item.mrp * 10 }, create: { productId: product.id, name: item.unit.name === 'Capsule' ? 'Box of 10 capsules' : 'Strip of 10 tablets', unitId: item.unit.id, conversionToBase: 10, isSellable: false, isPurchaseUnit: true, sellingPrice: item.selling * 10, mrp: item.mrp * 10 } });
    await prisma.productSupplier.upsert({ where: { productId_supplierId: { productId: product.id, supplierId: supplier.id } }, update: { purchasePrice: item.purchase, isPreferred: true, productBatchId: batch.id }, create: { productId: product.id, supplierId: supplier.id, purchasePrice: item.purchase, isPreferred: true, productBatchId: batch.id } });
    await prisma.stock.upsert({ where: { storeId_productId_batchId: { storeId: store.id, productId: product.id, batchId: batch.id } }, update: { quantity: item.stock }, create: { storeId: store.id, productId: product.id, batchId: batch.id, quantity: item.stock } });
  }
  console.log('Demo catalog, suppliers, customers and opening stock seeded');
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
