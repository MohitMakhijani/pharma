const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Run this from the pharma folder with the app dotenv loaded.');
}

const client = new Client({ connectionString });

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function slugName(value) {
  return normalizeName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20) || 'product';
}

async function compareProductFlow(storeId, productName) {
  const name = normalizeName(productName);

  const existing = await client.query(
    `SELECT * FROM "Product"
     WHERE "storeId" = $1 AND LOWER("name") = LOWER($2)
     LIMIT 1;`,
    [storeId, name]
  );

  console.log('BEFORE CREATE:');
  console.dir(existing.rows[0] || null, { depth: 10 });

  let created = null;

  if (!existing.rows[0]) {
    const skuBase = slugName(name);
    const skuResult = await client.query(
      `SELECT "sku" FROM "Product" WHERE "storeId" = $1 AND "sku" LIKE $2 ORDER BY "createdAt" DESC;`,
      [storeId, `${skuBase}%`]
    );

    const sku = `${skuBase}-${skuResult.rowCount + 1}`;

    const unitResult = await client.query(
      `SELECT "id" FROM "Unit" ORDER BY "createdAt" ASC LIMIT 1;`
    );

    if (!unitResult.rowCount) {
      throw new Error('No unit exists in the database. Add a unit before creating a product.');
    }

    const unitId = unitResult.rows[0].id;

    const insert = await client.query(
      `INSERT INTO "Product"
        ("storeId", "name", "sku", "hsnCode", "gstPercent", "baseUnitId", "status", "prescriptionOnly", "dosageForm", "minimumStock", "reorderLevel", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *;`,
      [storeId, name, sku, '1234', 12, unitId, 'ACTIVE', false, 'Tablet', 0, 0]
    );

    created = insert.rows[0];
    console.log('\nCREATED PRODUCT ROW:');
    console.dir(created, { depth: 10 });
  }

  const matches = await client.query(
    `SELECT * FROM "Product"
     WHERE "storeId" = $1 AND LOWER("name") LIKE LOWER($2)
     ORDER BY "createdAt" DESC;`,
    [storeId, `%${name}%`]
  );

  const total = await client.query(
    `SELECT COUNT(*)::int AS count FROM "Product" WHERE "storeId" = $1;`,
    [storeId]
  );

  console.log('\nMATCHES IN STORE:');
  console.dir(matches.rows, { depth: 10 });

  console.log('\nTOTAL PRODUCTS IN STORE:', total.rows[0].count);

  if (created) {
    console.log('\nDIFF BETWEEN BEFORE AND AFTER:', {
      existedBefore: false,
      createdProductId: created.id,
      createdName: created.name,
      createdSku: created.sku,
      createdStoreId: created.storeId,
    });
  } else {
    console.log('\nDIFF BETWEEN BEFORE AND AFTER:', {
      existedBefore: true,
      existingProductId: existing.rows[0].id,
      existingName: existing.rows[0].name,
      existingSku: existing.rows[0].sku,
    });
  }
}

async function main() {
  const storeId = process.argv[2] || process.env.STORE_ID || 'cmta0rkah00019orroe4cal1v';
  const productName = process.argv[3] || 'hello';

  await client.connect();
  await compareProductFlow(storeId, productName);
}

main()
  .catch((error) => {
    console.error('ERROR:', error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
