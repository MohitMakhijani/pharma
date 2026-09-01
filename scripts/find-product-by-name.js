const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Run this from the pharma folder with the app env loaded.');
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

async function main() {
  const searchTerm = process.argv[2] || 'hello';
  const storeId = process.argv[3] || process.env.STORE_ID || 'cmta0rkah00019orroe4cal1v';

  await client.connect();

  const search = `%${searchTerm}%`;
  const rows = await client.query(
    `SELECT * FROM "Product"
     WHERE "storeId" = $1
       AND (
         LOWER("name") LIKE LOWER($2)
         OR LOWER("sku") LIKE LOWER($2)
       )
     ORDER BY "name" ASC;`,
    [storeId, search]
  );

  console.log('FOUND:', rows.rowCount);
  console.dir(rows.rows, { depth: 10 });

  const total = await client.query(
    `SELECT COUNT(*)::int AS count FROM "Product" WHERE "storeId" = $1;`,
    [storeId]
  );

  console.log('TOTAL PRODUCTS IN STORE:', total.rows[0].count);
}

main()
  .catch((error) => {
    console.error('ERROR:', error);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
