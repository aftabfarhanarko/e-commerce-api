#!/usr/bin/env node
/**
 * Run a SQL migration file.
 * Usage: node scripts/run-migration.js migrations/002_add_customer_email_to_orders.sql
 * Requires DATABASE_URL in .env or environment
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Load .env if exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

const migrationFile = process.argv[2] || 'migrations/002_add_customer_email_to_orders.sql';
const sqlPath = path.join(__dirname, '..', migrationFile);

if (!fs.existsSync(sqlPath)) {
  console.error('Migration file not found:', sqlPath);
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set. Add it to .env or environment.');
  process.exit(1);
}
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration completed:', migrationFile);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
