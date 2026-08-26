require('dotenv').config();

const prisma = require('../src/config/prisma');
const { hashPassword } = require('../src/utils/password');

const medicines = [
  'Paracetamol', 'Ibuprofen', 'Diclofenac', 'Aceclofenac', 'Naproxen', 'Aspirin', 'Ketorolac', 'Etodolac', 'Mefenamic Acid', 'Tramadol',
  'Amoxicillin', 'Amoxicillin Clavulanate', 'Azithromycin', 'Cefixime', 'Cefuroxime', 'Cefpodoxime', 'Ceftriaxone', 'Ciprofloxacin', 'Levofloxacin', 'Ofloxacin',
  'Moxifloxacin', 'Doxycycline', 'Minocycline', 'Clindamycin', 'Linezolid', 'Meropenem', 'Metronidazole', 'Tinidazole', 'Nitrofurantoin', 'Fosfomycin',
  'Fluconazole', 'Itraconazole', 'Terbinafine', 'Acyclovir', 'Oseltamivir', 'Albendazole', 'Mebendazole', 'Ivermectin', 'Permethrin', 'Mupirocin',
  'Pantoprazole', 'Rabeprazole', 'Omeprazole', 'Esomeprazole', 'Lansoprazole', 'Famotidine', 'Domperidone', 'Ondansetron', 'Metoclopramide', 'Loperamide',
  'Oral Rehydration Salts', 'Lactulose', 'Bisacodyl', 'Isabgol', 'Dicyclomine', 'Mebeverine', 'Sucralfate', 'Mesalazine', 'Ursodeoxycholic Acid', 'Silymarin',
  'Metformin', 'Glimepiride', 'Gliclazide', 'Glipizide', 'Sitagliptin', 'Vildagliptin', 'Linagliptin', 'Teneligliptin', 'Empagliflozin', 'Dapagliflozin',
  'Glibenclamide', 'Pioglitazone', 'Acarbose', 'Insulin Human', 'Insulin Glargine', 'Liraglutide', 'Semaglutide', 'Levothyroxine', 'Carbimazole', 'Propylthiouracil',
  'Amlodipine', 'Nifedipine', 'Cilnidipine', 'Felodipine', 'Enalapril', 'Lisinopril', 'Ramipril', 'Perindopril', 'Losartan', 'Telmisartan',
  'Olmesartan', 'Valsartan', 'Atenolol', 'Metoprolol', 'Propranolol', 'Carvedilol', 'Bisoprolol', 'Furosemide', 'Torsemide', 'Spironolactone',
  'Hydrochlorothiazide', 'Rosuvastatin', 'Atorvastatin', 'Simvastatin', 'Fenofibrate', 'Ezetimibe', 'Clopidogrel', 'Ticagrelor', 'Rivaroxaban', 'Apixaban',
  'Warfarin', 'Isosorbide Mononitrate', 'Nitroglycerin', 'Ivabradine', 'Digoxin', 'Amiodarone', 'Diltiazem', 'Verapamil', 'Sacubitril Valsartan', 'Dapagliflozin',
  'Cetirizine', 'Levocetirizine', 'Loratadine', 'Fexofenadine', 'Desloratadine', 'Montelukast', 'Salbutamol', 'Budesonide', 'Formoterol', 'Fluticasone',
  'Beclometasone', 'Tiotropium', 'Theophylline', 'Aminophylline', 'Ipratropium', 'Ambroxol', 'Bromhexine', 'Guaifenesin', 'Dextromethorphan', 'Acetylcysteine',
  'Prednisolone', 'Dexamethasone', 'Methylprednisolone', 'Hydrocortisone', 'Deflazacort', 'Betamethasone', 'Hydroxychloroquine', 'Methotrexate', 'Azathioprine', 'Cyclosporine',
  'Sertraline', 'Escitalopram', 'Fluoxetine', 'Paroxetine', 'Venlafaxine', 'Duloxetine', 'Amitriptyline', 'Clonazepam', 'Alprazolam', 'Lorazepam',
  'Diazepam', 'Pregabalin', 'Gabapentin', 'Levetiracetam', 'Carbamazepine', 'Sodium Valproate', 'Phenytoin', 'Topiramate', 'Donepezil', 'Memantine',
  'Tamsulosin', 'Finasteride', 'Sildenafil', 'Tadalafil', 'Solifenacin', 'Mirabegron', 'Potassium Citrate', 'Dutasteride', 'Alfuzosin', 'Silodosin',
  'Calcium Carbonate', 'Cholecalciferol', 'Calcitriol', 'Iron Folic Acid', 'Ferrous Ascorbate', 'Methylcobalamin', 'Thiamine', 'Pyridoxine', 'Cyanocobalamin', 'Ascorbic Acid',
  'Vitamin A', 'Vitamin E', 'Zinc Sulphate', 'Magnesium Hydroxide', 'Multivitamin', 'Folic Acid', 'Biotin', 'Lycopene', 'Omega 3 Fatty Acids', 'Glucosamine',
  'Clotrimazole', 'Ketoconazole', 'Sertaconazole', 'Luliconazole', 'Eberconazole', 'Adapalene', 'Tretinoin', 'Benzoyl Peroxide', 'Calamine', 'Hydroquinone',
  'Betamethasone Clotrimazole', 'Hydrocortisone', 'Tacrolimus', 'Povidone Iodine', 'Chlorhexidine', 'Silver Sulfadiazine', 'Lidocaine', 'Benzocaine', 'Naphazoline', 'Xylometazoline',
];

const forms = [
  { name: 'Tablet', unit: 'Tablet', symbol: 'tab', type: 'COUNT', strengths: ['5mg', '10mg', '20mg', '40mg', '50mg', '75mg', '100mg', '250mg', '500mg'] },
  { name: 'Capsule', unit: 'Capsule', symbol: 'cap', type: 'COUNT', strengths: ['10mg', '20mg', '40mg', '50mg', '75mg', '100mg', '250mg', '500mg'] },
  { name: 'Syrup', unit: 'ml', symbol: 'ml', type: 'VOLUME', strengths: ['100ml', '60ml', '100mg/5ml', '250mg/5ml'] },
  { name: 'Cream', unit: 'gm', symbol: 'gm', type: 'WEIGHT', strengths: ['10gm', '15gm', '20gm', '30gm'] },
  { name: 'Injection', unit: 'ml', symbol: 'ml', type: 'VOLUME', strengths: ['1ml', '2ml', '5ml', '10ml'] },
  { name: 'Drops', unit: 'ml', symbol: 'ml', type: 'VOLUME', strengths: ['5ml', '10ml', '15ml'] },
  { name: 'Inhaler', unit: 'dose', symbol: 'dose', type: 'COUNT', strengths: ['100 doses', '120 doses', '200 doses'] },
  { name: 'Ointment', unit: 'gm', symbol: 'gm', type: 'WEIGHT', strengths: ['10gm', '15gm', '20gm'] },
];

const supplierNames = [
  'Northstar Pharma Ltd.', 'Medline Distribution', 'Apollo Medico Wholesale', 'Guardian Life Sciences',
  'Sunrise Pharma Hub', 'CareFirst Distributors', 'Curewell Healthcare Supply', 'Madhya Medical Agencies',
];
const customerNames = [
  'Sharma Medical Store', 'City Care Clinic', 'Jabalpur Health Centre', 'Narmada Nursing Home',
  'Vijay Medical Hall', 'MediPoint Pharmacy', 'Sanjeevani Clinic', 'LifeLine Hospital',
  'Arogya Chemist', 'Central India Care',
];
const manufacturerNames = ['Sun Pharma', 'Cipla', 'Dr. Reddy\'s Laboratories', 'Mankind Pharma', 'Zydus Lifesciences', 'Lupin', 'Torrent Pharma', 'Abbott India', 'Alkem Laboratories', 'Glenmark'];
const categoryNames = ['Analgesic', 'Antibiotic', 'Antidiabetic', 'Cardiology', 'Gastroenterology', 'Respiratory', 'Dermatology', 'Vitamins & Minerals', 'Neurology', 'Urology'];

let randomState = 20260826;
function random() {
  randomState = (randomState * 1664525 + 1013904223) % 4294967296;
  return randomState / 4294967296;
}
function pick(values) { return values[Math.floor(random() * values.length)]; }
function chunks(items, size = 500) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
function daysAgo(days) { const date = new Date(); date.setDate(date.getDate() - days); return date; }

async function clearDatabase() {
  const tables = [
    'prescriptionItem', 'purchaseReturnItem', 'salesReturnItem', 'purchasePayment', 'salePayment',
    'purchaseItem', 'saleItem', 'stockMovement', 'purchaseReturn', 'salesReturn', 'purchase', 'sale',
    'payment', 'ledgerEntry', 'stock', 'productSupplier', 'productPackaging', 'productBatch', 'prescription',
    'productSalt', 'product', 'salt', 'customer', 'supplier', 'notification', 'auditLog', 'user', 'role', 'category', 'manufacturer', 'unit', 'store',
  ];
  for (const table of tables) {
    await prisma[table].deleteMany();
  }
}

async function main() {
  console.log('Resetting all application data...');
  await clearDatabase();

  const role = await prisma.role.create({ data: { name: 'ADMIN', description: 'Pharmacy administrator' } });
  const store = await prisma.store.create({ data: { name: 'Main Pharmacy', code: 'MAIN', city: 'Jabalpur', state: 'Madhya Pradesh', isActive: true } });
  await prisma.user.create({ data: { name: 'Pharmacy Admin', email: 'admin@pharmaerp.com', passwordHash: await hashPassword('Admin@12345'), storeId: store.id, roleId: role.id } });

  const categories = await Promise.all(categoryNames.map((name) => prisma.category.create({ data: { name } })));
  const manufacturers = await Promise.all(manufacturerNames.map((name) => prisma.manufacturer.create({ data: { name } })));
  const unitsByType = {};
  for (const form of forms) {
    if (!unitsByType[form.unit]) unitsByType[form.unit] = await prisma.unit.create({ data: { name: form.unit, symbol: form.symbol, type: form.type } });
  }
  const suppliers = await Promise.all(supplierNames.map((name, index) => prisma.supplier.create({ data: { storeId: store.id, name, contactPerson: `Contact ${index + 1}`, phone: `98260${String(10000 + index).slice(-5)}`, email: `orders${index + 1}@supplier.example`, city: index % 2 ? 'Bhopal' : 'Jabalpur', state: 'Madhya Pradesh', creditLimit: 100000 + index * 25000, creditDays: 15 + (index % 4) * 15 } })));
  const customers = await Promise.all(customerNames.map((name, index) => prisma.customer.create({ data: { storeId: store.id, name, phone: `98930${String(20000 + index).slice(-5)}`, email: `customer${index + 1}@example.com`, city: index % 2 ? 'Bhopal' : 'Jabalpur', state: 'Madhya Pradesh', creditLimit: 50000 + index * 10000, creditDays: 15 + (index % 3) * 15 } })));

  const productRows = [];
  for (let index = 0; index < 1000; index += 1) {
    const ingredient = medicines[index % medicines.length];
    const form = forms[index % forms.length];
    const strength = form.strengths[Math.floor(index / medicines.length) % form.strengths.length];
    const dosageForm = form.name;
    const schedule = index % 29 === 0 ? 'NRx' : index % 11 === 0 ? 'H1' : index % 17 === 0 ? 'Schedule H' : null;
    productRows.push({
      id: `real-product-${String(index + 1).padStart(4, '0')}`,
      storeId: store.id,
      name: `${ingredient} ${strength} ${dosageForm}`,
      genericName: ingredient,
      brandName: `${ingredient} ${form.name}`,
      sku: `IND-MED-${String(index + 1).padStart(4, '0')}`,
      barcode: `890${String(1000000000 + index).slice(-10)}`,
      hsnCode: '3004',
      rack: `R-${String((index % 40) + 1).padStart(2, '0')}`,
      scheduling: schedule,
      prescriptionOnly: Boolean(schedule),
      dosageForm,
      strength: 1,
      strengthUnitId: unitsByType[form.unit].id,
      categoryId: categories[index % categories.length].id,
      manufacturerId: manufacturers[index % manufacturers.length].id,
      gstPercent: index % 4 === 0 ? 12 : 5,
      baseUnitId: unitsByType[form.unit].id,
      minimumStock: 20,
      reorderLevel: 50,
    });
  }
  for (const batch of chunks(productRows)) await prisma.product.createMany({ data: batch });

  const saltNames = [...new Set(productRows.map((product) => product.genericName.trim()))];
  await prisma.salt.createMany({ data: saltNames.map((name) => ({ name })) });
  const salts = await prisma.salt.findMany({ where: { name: { in: saltNames } }, select: { id: true, name: true } });
  const saltByName = new Map(salts.map((salt) => [salt.name, salt.id]));
  await prisma.productSalt.createMany({ data: productRows.map((product) => ({ productId: product.id, saltId: saltByName.get(product.genericName.trim()) })) });

  const batchRows = productRows.map((product, index) => ({
    id: `real-batch-${String(index + 1).padStart(4, '0')}`,
    storeId: store.id,
    productId: product.id,
    batchNumber: `B${String(index + 1).padStart(5, '0')}`,
    manufacturingDate: new Date('2025-01-01'),
    expiryDate: new Date(2027 + (index % 3), index % 12, 28),
    purchasePrice: 12 + (index % 95),
    costPerBaseUnit: 12 + (index % 95),
    mrp: 20 + (index % 180),
    sellingPrice: 18 + (index % 165),
  }));
  for (const batch of chunks(batchRows)) await prisma.productBatch.createMany({ data: batch });

  const packagingRows = productRows.map((product, index) => {
    const form = forms[index % forms.length];
    const unitId = unitsByType[form.unit].id;
    const packageName = form.name === 'Cream' || form.name === 'Ointment' ? '10gm' : form.name === 'Syrup' ? '100ml' : form.name === 'Injection' ? '1ml' : form.name === 'Drops' ? '10ml' : form.name === 'Capsule' ? '1*10' : '1*15';
    return { productId: product.id, name: packageName, unitId, conversionToBase: 1, isSellable: true, isPurchaseUnit: true, mrp: 20 + (index % 180), sellingPrice: 18 + (index % 165), isDefault: true };
  });
  for (const batch of chunks(packagingRows)) await prisma.productPackaging.createMany({ data: batch });

  const supplierRows = [];
  for (let productIndex = 0; productIndex < productRows.length; productIndex += 1) {
    for (let offset = 0; offset < suppliers.length; offset += 1) {
      const supplier = suppliers[(productIndex + offset) % suppliers.length];
      supplierRows.push({ productId: productRows[productIndex].id, supplierId: supplier.id, purchasePrice: 12 + (productIndex % 95) + offset, isPreferred: offset === 0, productBatchId: batchRows[productIndex].id });
    }
  }
  for (const batch of chunks(supplierRows)) await prisma.productSupplier.createMany({ data: batch });

  const stockRows = batchRows.map((batch, index) => ({ storeId: store.id, productId: batch.productId, batchId: batch.id, quantity: 100 + (index % 400) }));
  for (const batch of chunks(stockRows)) await prisma.stock.createMany({ data: batch });
  const stocks = await prisma.stock.findMany({ where: { storeId: store.id }, orderBy: { productId: 'asc' } });

  for (let index = 0; index < 100; index += 1) {
    const supplier = suppliers[index % suppliers.length];
    const purchaseItems = [];
    for (let itemIndex = 0; itemIndex < 8; itemIndex += 1) {
      const productIndex = (index * 8 + itemIndex) % productRows.length;
      const product = productRows[productIndex];
      const batch = batchRows[productIndex];
      const quantity = 5 + (itemIndex % 8);
      const price = Number(batch.purchasePrice);
      const taxable = quantity * price;
      const gst = taxable * 0.05;
      purchaseItems.push({ productId: product.id, batchId: batch.id, quantity, baseQuantity: quantity, purchasePrice: price, mrp: batch.mrp, sellingPrice: batch.sellingPrice, taxableAmount: taxable, totalAmount: taxable + gst, cgstPercent: 2.5, cgstAmount: gst / 2, sgstPercent: 2.5, sgstAmount: gst / 2 });
    }
    const subtotal = purchaseItems.reduce((sum, item) => sum + item.taxableAmount, 0);
    const total = purchaseItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const purchase = await prisma.purchase.create({ data: { storeId: store.id, supplierId: supplier.id, invoiceNumber: `PUR-REAL-${String(index + 1).padStart(4, '0')}`, invoiceDate: daysAgo(180 - index), receivedDate: daysAgo(180 - index), subtotal, taxableAmount: subtotal, cgstAmount: total - subtotal ? (total - subtotal) / 2 : 0, sgstAmount: total - subtotal ? (total - subtotal) / 2 : 0, totalAmount: total, paidAmount: index % 3 === 0 ? total : total / 2, dueAmount: index % 3 === 0 ? 0 : total / 2, paymentStatus: index % 3 === 0 ? 'PAID' : 'PARTIAL' }, select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true } });
    await prisma.purchaseItem.createMany({ data: purchaseItems.map((item) => ({ ...item, purchaseId: purchase.id })) });
    if (purchase.paidAmount > 0) await prisma.purchasePayment.create({ data: { purchaseId: purchase.id, amount: purchase.paidAmount, paymentMethod: index % 2 ? 'BANK_TRANSFER' : 'UPI', paymentDate: daysAgo(179 - index) } });
    await prisma.ledgerEntry.create({ data: { storeId: store.id, ledgerType: 'SUPPLIER', supplierId: supplier.id, entryType: 'PURCHASE', amount: total, referenceId: purchase.id, referenceNumber: purchase.invoiceNumber, description: 'Seeded purchase invoice', entryDate: daysAgo(180 - index) } });
    if (purchase.paidAmount > 0) await prisma.ledgerEntry.create({ data: { storeId: store.id, ledgerType: 'SUPPLIER', supplierId: supplier.id, entryType: 'PURCHASE_PAYMENT', amount: -purchase.paidAmount, referenceId: purchase.id, referenceNumber: purchase.invoiceNumber, description: 'Seeded supplier payment', entryDate: daysAgo(179 - index) } });
  }

  for (let index = 0; index < 180; index += 1) {
    const customer = index % 5 === 0 ? null : customers[index % customers.length];
    const saleItems = [];
    for (let itemIndex = 0; itemIndex < 6; itemIndex += 1) {
      const productIndex = (index * 6 + itemIndex * 7) % productRows.length;
      const product = productRows[productIndex];
      const batch = batchRows[productIndex];
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
    const sale = await prisma.sale.create({ data: { storeId: store.id, customerId: customer?.id, invoiceNumber: `SAL-REAL-${String(index + 1).padStart(4, '0')}`, invoiceDate: daysAgo(120 - (index % 120)), subtotal, taxableAmount: subtotal, cgstAmount: (total - subtotal) / 2, sgstAmount: (total - subtotal) / 2, totalAmount: total, paidAmount: paid, dueAmount: total - paid, paymentStatus: paid === total ? 'PAID' : 'PARTIAL' }, select: { id: true, invoiceNumber: true } });
    await prisma.saleItem.createMany({ data: saleItems.map((item) => ({ ...item, saleId: sale.id })) });
    if (paid > 0) await prisma.salePayment.create({ data: { saleId: sale.id, amount: paid, paymentMethod: index % 2 ? 'CASH' : 'UPI', paymentDate: daysAgo(119 - (index % 120)) } });
    if (customer) {
      await prisma.ledgerEntry.create({ data: { storeId: store.id, ledgerType: 'CUSTOMER', customerId: customer.id, entryType: 'SALE', amount: total, referenceId: sale.id, referenceNumber: sale.invoiceNumber, description: 'Seeded customer sale', entryDate: daysAgo(120 - (index % 120)) } });
      await prisma.ledgerEntry.create({ data: { storeId: store.id, ledgerType: 'CUSTOMER', customerId: customer.id, entryType: 'SALE_PAYMENT', amount: -paid, referenceId: sale.id, referenceNumber: sale.invoiceNumber, description: 'Seeded customer collection', entryDate: daysAgo(119 - (index % 120)) } });
    }
  }

  const movementRows = stocks.map((stock, index) => ({ storeId: store.id, productId: stock.productId, batchId: stock.batchId, stockId: stock.id, type: 'OPENING_STOCK', referenceType: 'MANUAL', quantity: Number(stock.quantity), quantityBefore: 0, quantityAfter: Number(stock.quantity), unitCost: 12 + (index % 95), reason: 'Opening stock seeded', createdById: null }));
  for (const batch of chunks(movementRows)) await prisma.stockMovement.createMany({ data: batch });

  await prisma.payment.createMany({ data: suppliers.slice(0, 6).map((supplier, index) => ({ storeId: store.id, supplierId: supplier.id, amount: 5000 + index * 750, paymentMethod: index % 2 ? 'BANK_TRANSFER' : 'UPI', paymentDate: daysAgo(30 - index), notes: 'Seeded supplier settlement' })) });
  await prisma.payment.createMany({ data: customers.slice(0, 6).map((customer, index) => ({ storeId: store.id, customerId: customer.id, amount: 2500 + index * 450, paymentMethod: index % 2 ? 'CASH' : 'UPI', paymentDate: daysAgo(20 - index), notes: 'Seeded customer collection' })) });

  const counts = {
    products: await prisma.product.count({ where: { storeId: store.id } }),
    suppliers: await prisma.supplier.count({ where: { storeId: store.id } }),
    customers: await prisma.customer.count({ where: { storeId: store.id } }),
    purchases: await prisma.purchase.count({ where: { storeId: store.id } }),
    sales: await prisma.sale.count({ where: { storeId: store.id } }),
    ledgerEntries: await prisma.ledgerEntry.count({ where: { storeId: store.id } }),
    mappings: await prisma.productSupplier.count({ where: { product: { storeId: store.id } } }),
  };
  console.log('Real-world seed completed:', counts);
  console.log('Login: admin@pharmaerp.com / Admin@12345');
}

main().catch((error) => {
  console.error('Reset seed failed:', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
