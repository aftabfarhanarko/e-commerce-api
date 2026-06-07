const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  await client.connect();
  const res = await client.query(`
    SELECT pid, statement_timestamp() - query_start as duration, query, state
    FROM pg_stat_activity
    WHERE state != 'idle' AND query ILIKE '%tbl_products%' AND pid <> pg_backend_pid();
  `);
  console.log("Active queries on tbl_products:", res.rows);
  
  if (res.rows.length > 0) {
    console.log("Terminating blocking queries...");
    for (let row of res.rows) {
      await client.query(`SELECT pg_terminate_backend(${row.pid})`);
      console.log(`Terminated PID ${row.pid}`);
    }
  } else {
    console.log("No active queries holding locks.");
  }
  await client.end();
}
run().catch(console.error);
