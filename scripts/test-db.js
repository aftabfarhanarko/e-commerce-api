const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name='tbl_products';
  `);
  console.log("Columns in tbl_products:");
  res.rows.forEach(r => console.log(r.column_name));
  await client.end();
}
run().catch(console.error);
