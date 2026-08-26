require('dotenv').config();

const prisma = require('../src/config/prisma');

function normalizeSaltName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

async function main() {
  const products = await prisma.product.findMany({
    where: { genericName: { not: null } },
    select: { id: true, genericName: true },
  });
  const saltNames = [...new Set(products.map((product) => normalizeSaltName(product.genericName)).filter(Boolean))];

  for (const name of saltNames) {
    await prisma.salt.upsert({ where: { name }, update: {}, create: { name } });
  }

  const salts = await prisma.salt.findMany({ where: { name: { in: saltNames } }, select: { id: true, name: true } });
  const saltByName = new Map(salts.map((salt) => [salt.name, salt.id]));
  const mappings = products
    .map((product) => ({ productId: product.id, saltId: saltByName.get(normalizeSaltName(product.genericName)) }))
    .filter((mapping) => mapping.saltId);

  for (let index = 0; index < mappings.length; index += 500) {
    await prisma.productSalt.createMany({ data: mappings.slice(index, index + 500), skipDuplicates: true });
  }

  console.log(`Mapped ${mappings.length} products to ${saltNames.length} salts.`);
}

main().catch((error) => {
  console.error('Salt mapping failed:', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});