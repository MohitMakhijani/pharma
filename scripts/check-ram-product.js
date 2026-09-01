const prisma = require('../src/config/prisma');

(async () => {
  try {
    console.log('\n=== Checking for "ram" product ===\n');

    const product = await prisma.product.findFirst({
      where: { name: { equals: 'ram', mode: 'insensitive' } },
      include: {
        batches: { select: { id: true, batchNumber: true, expiryDate: true } },
        stock: { select: { id: true, quantity: true } },
      }
    });

    if (product) {
      console.log('✓ Product FOUND:');
      console.log('  ID:', product.id);
      console.log('  Name:', product.name);
      console.log('  SKU:', product.sku);
      console.log('  Store ID:', product.storeId);
      console.log('  Status:', product.status);
      console.log('  Batches:', product.batches.length);
      console.log('  Stock:', product.stock.length);
      console.log('\nFull product:', JSON.stringify(product, null, 2));
    } else {
      console.log('✗ Product NOT found in database');
      
      console.log('\n=== Checking ALL products to see what was created ===\n');
      const allProducts = await prisma.product.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, sku: true, createdAt: true }
      });
      console.log('Last 10 products:', JSON.stringify(allProducts, null, 2));
    }
  } catch(e) {
    console.error('Error:', e.message, '\n', e.stack);
  } finally {
    await prisma.$disconnect();
  }
})();
