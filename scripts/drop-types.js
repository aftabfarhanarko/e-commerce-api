const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    await client.query(`SET lock_timeout = '5s';`);
    await client.query(`ALTER TABLE "tbl_products" DROP COLUMN IF EXISTS "types";`);
    console.log("Successfully removed 'types' column from tbl_products.");
  } catch (e) {
    console.error("Error removing column:", e.message);
  } finally {
    await client.end();
  }
}
run();
