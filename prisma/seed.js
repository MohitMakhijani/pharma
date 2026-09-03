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

  // Create standard system roles
  const rolesToCreate = [
    { name: 'ADMIN', description: 'Pharmacy Administrator with full access' },
    { name: 'PHARMACIST', description: 'Licensed Pharmacist with inventory & dispensing access' },
    { name: 'STAFF', description: 'Pharmacy Staff for counter sales and stock entry' },
    { name: 'CASHIER', description: 'Point of Sale Cashier for billing & checkout' },
    { name: 'MANAGER', description: 'Store Manager for reports & inventory tracking' },
  ];

  const createdRoles = {};
  for (const r of rolesToCreate) {
    createdRoles[r.name] = await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: { name: r.name, description: r.description },
    });
  }

  const adminRole = createdRoles['ADMIN'];

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
  const supplierNames = ['Medline Distribution', 'Apollo Medico Wholesale', 'Guardian Life Sciences', 'Sunrise Pharma Hub', 'CareFirst Distributors'];
  const supplierPool = [supplier];
  for (const [index, name] of supplierNames.entries()) {
    supplierPool.push(await prisma.supplier.upsert({
      where: { id: `demo-supplier-${index + 2}` },
      update: { name },
      create: { id: `demo-supplier-${index + 2}`, storeId: store.id, name, contactPerson: `Contact ${index + 2}`, phone: `98765000${String(index + 2).padStart(2, '0')}`, city: 'Jabalpur', state: 'Madhya Pradesh', creditLimit: 100000 + index * 25000, creditDays: 15 + index * 5 },
    }));
  }
  const allStoreSuppliers = await prisma.supplier.findMany({
    where: { storeId: store.id },
    orderBy: { id: 'asc' },
  });
  supplierPool.splice(0, supplierPool.length, ...allStoreSuppliers);
  await prisma.customer.upsert({ where: { id: 'demo-customer-cedar' }, update: {}, create: { id: 'demo-customer-cedar', storeId: store.id, name: 'Cedar Grove Clinic', phone: '9876510001', email: 'clinic@cedargrove.example', city: 'Jabalpur', creditLimit: 100000, creditDays: 30 } });
  await prisma.customer.upsert({ where: { id: 'demo-customer-westside' }, update: {}, create: { id: 'demo-customer-westside', storeId: store.id, name: 'Westside Pharmacy', phone: '9876510002', email: 'orders@westside.example', city: 'Jabalpur', creditLimit: 75000, creditDays: 15 } });
  const products = [
    { id: 'demo-product-paracetamol', name: 'Paracetamol 500mg', sku: 'PAR-500-TAB', genericName: 'Paracetamol', category: categories.Analgesic, manufacturer: manufacturers['Harbor Labs'], unit: tabletUnit, batch: 'PAR-0826', purchase: 45, mrp: 70, selling: 63, stock: 480 },
    { id: 'demo-product-amoxicillin', name: 'Amoxicillin 500mg', sku: 'AMX-500-CAP', genericName: 'Amoxicillin', category: categories.Antibiotic, manufacturer: manufacturers['Curewell Pharma'], unit: capsuleUnit, batch: 'AMX-0726', purchase: 72, mrp: 110, selling: 99, stock: 220 },
    { id: 'demo-product-metformin', name: 'Metformin 850mg', sku: 'MET-850-TAB', genericName: 'Metformin', category: categories.Diabetes, manufacturer: manufacturers['Northstar Healthcare'], unit: tabletUnit, batch: 'MET-0626', purchase: 38, mrp: 60, selling: 54, stock: 96 },
  ];
  const additionalMedicineNames = [
    'Atorvastatin 10mg', 'Amlodipine 5mg', 'Telmisartan 40mg', 'Losartan 50mg', 'Pantoprazole 40mg',
    'Esomeprazole 40mg', 'Rabeprazole 20mg', 'Azithromycin 500mg', 'Cefixime 200mg', 'Doxycycline 100mg',
    'Ciprofloxacin 500mg', 'Levocetirizine 5mg', 'Montelukast 10mg', 'Cetirizine 10mg', 'Diclofenac 50mg',
    'Ibuprofen 400mg', 'Aceclofenac 100mg', 'Ondansetron 4mg', 'Domperidone 10mg', 'Glimepiride 2mg',
    'Sitagliptin 100mg', 'Glipizide 5mg', 'Empagliflozin 10mg', 'Rosuvastatin 10mg', 'Clopidogrel 75mg',
    'Aspirin 75mg', 'Furosemide 40mg', 'Spironolactone 25mg', 'Propranolol 40mg', 'Metoprolol 25mg',
    'Prednisolone 10mg', 'Methylprednisolone 4mg', 'Fluconazole 150mg', 'Albendazole 400mg', 'Famotidine 20mg',
    'Loperamide 2mg', 'Calcium Carbonate 500mg', 'Iron Folic Acid Tablet', 'Vitamin B Complex', 'Vitamin D3 60000IU',
    'Salbutamol 4mg', 'Budesonide 0.5mg', 'Cefuroxime 500mg', 'Linezolid 600mg', 'Meropenem 1g',
    'Levothyroxine 50mcg', 'Insulin Glargine 100IU', 'Mupirocin 2% Cream', 'Clotrimazole 1% Cream', 'ORS Orange Sachet',
  ];
  products.push(...additionalMedicineNames.map((name, index) => ({
    id: `demo-product-${index + 4}`,
    name,
    sku: `MED-${String(index + 4).padStart(3, '0')}`,
    genericName: name.split(' ')[0],
    category: index % 3 === 0 ? categories.Analgesic : index % 3 === 1 ? categories.Antibiotic : categories.Diabetes,
    manufacturer: [manufacturers['Harbor Labs'], manufacturers['Curewell Pharma'], manufacturers['Northstar Healthcare']][index % 3],
    unit: index % 4 === 0 ? capsuleUnit : tabletUnit,
    batch: `B-${String(index + 4).padStart(3, '0')}-26`,
    purchase: 20 + (index * 7) % 85,
    mrp: 35 + (index * 11) % 160,
    selling: 32 + (index * 10) % 145,
    stock: 12 + (index * 29) % 260,
  })));
  for (const item of products) {
    const schedule = item.name.includes('Meropenem') || item.name.includes('Linezolid') ? 'H1' : item.name.includes('Codeine') ? 'NRx' : item.name.includes('Insulin') ? 'Schedule H' : null;
    const product = await prisma.product.upsert({ where: { id: item.id }, update: { categoryId: item.category.id, manufacturerId: item.manufacturer.id, baseUnitId: item.unit.id, strengthUnitId: item.unit.id, rack: `R-${(products.indexOf(item) % 12) + 1}`, scheduling: schedule, prescriptionOnly: Boolean(schedule) }, create: { id: item.id, storeId: store.id, name: item.name, sku: item.sku, genericName: item.genericName, dosageForm: item.unit.name, strength: 500, categoryId: item.category.id, manufacturerId: item.manufacturer.id, baseUnitId: item.unit.id, strengthUnitId: item.unit.id, gstPercent: 5, minimumStock: 100, reorderLevel: 150, rack: `R-${(products.indexOf(item) % 12) + 1}`, scheduling: schedule, prescriptionOnly: Boolean(schedule) } });
    const batch = await prisma.productBatch.upsert({ where: { id: `${item.id}-batch` }, update: {}, create: { id: `${item.id}-batch`, storeId: store.id, productId: product.id, batchNumber: item.batch, manufacturingDate: new Date('2026-01-01'), expiryDate: new Date('2027-12-31'), purchasePrice: item.purchase, costPerBaseUnit: item.purchase, mrp: item.mrp, sellingPrice: item.selling } });
    const defaultPackagingName = item.unit.name === 'Capsule' ? '1*10' : '1*15';
    const existingPackaging = await prisma.productPackaging.findFirst({ where: { productId: product.id, isDefault: true } });
    if (existingPackaging) {
      await prisma.productPackaging.update({ where: { id: existingPackaging.id }, data: { name: defaultPackagingName, conversionToBase: 1, isSellable: true, isPurchaseUnit: true, sellingPrice: item.selling, mrp: item.mrp } });
    } else {
      await prisma.productPackaging.create({ data: { productId: product.id, name: defaultPackagingName, unitId: item.unit.id, conversionToBase: 1, isSellable: true, isPurchaseUnit: true, sellingPrice: item.selling, mrp: item.mrp, isDefault: true } });
    }
    await prisma.productPackaging.upsert({ where: { productId_name: { productId: product.id, name: item.unit.name === 'Capsule' ? 'Box of 10 capsules' : 'Strip of 10 tablets' } }, update: { conversionToBase: 10, isSellable: false, isPurchaseUnit: true, sellingPrice: item.selling * 10, mrp: item.mrp * 10 }, create: { productId: product.id, name: item.unit.name === 'Capsule' ? 'Box of 10 capsules' : 'Strip of 10 tablets', unitId: item.unit.id, conversionToBase: 10, isSellable: false, isPurchaseUnit: true, sellingPrice: item.selling * 10, mrp: item.mrp * 10 } });
    const productIndex = products.indexOf(item);
    const mappedSuppliers = supplierPool.map((_, supplierIndex) => (
      supplierPool[(supplierIndex + productIndex) % supplierPool.length]
    ));
    for (const [supplierIndex, mappedSupplier] of mappedSuppliers.entries()) {
      await prisma.productSupplier.upsert({ where: { productId_supplierId: { productId: product.id, supplierId: mappedSupplier.id } }, update: { purchasePrice: item.purchase + supplierIndex * 2, isPreferred: supplierIndex === 0, productBatchId: batch.id }, create: { productId: product.id, supplierId: mappedSupplier.id, purchasePrice: item.purchase + supplierIndex * 2, isPreferred: supplierIndex === 0, productBatchId: batch.id } });
    }
    await prisma.stock.upsert({ where: { storeId_productId_batchId: { storeId: store.id, productId: product.id, batchId: batch.id } }, update: { quantity: item.stock }, create: { storeId: store.id, productId: product.id, batchId: batch.id, quantity: item.stock } });
  }
  const everyStoreProduct = await prisma.product.findMany({
    where: { storeId: store.id },
    include: { batches: { where: { storeId: store.id }, orderBy: { expiryDate: 'asc' }, take: 1 } },
    orderBy: { id: 'asc' },
  });
  for (const [productIndex, product] of everyStoreProduct.entries()) {
    for (const [supplierIndex, mappedSupplier] of supplierPool.entries()) {
      await prisma.productSupplier.upsert({
        where: { productId_supplierId: { productId: product.id, supplierId: mappedSupplier.id } },
        update: { isPreferred: supplierIndex === productIndex % supplierPool.length, productBatchId: product.batches[0]?.id || null },
        create: { productId: product.id, supplierId: mappedSupplier.id, purchasePrice: 0, isPreferred: supplierIndex === productIndex % supplierPool.length, productBatchId: product.batches[0]?.id || null },
      });
    }
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
