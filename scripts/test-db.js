const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name='tbl_products';
  `);
  console.log("Columns in tbl_products:", res.rows.map(r => r.column_name));
  await client.end();
}
run().catch(console.error);
