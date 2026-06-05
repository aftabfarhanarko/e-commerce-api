const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_JZFCT1zx5Vwi@ep-green-field-a1nej44z-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    // Find the sequence name for orders.id
    const res = await client.query(`
      SELECT pg_get_serial_sequence('orders', 'id');
    `);
    const seqName = res.rows[0].pg_get_serial_sequence;
    console.log('Sequence name:', seqName);

    if (seqName) {
      const fixRes = await client.query(`
        SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM orders) + 1, 1), false);
      `);
      console.log('Sequence updated:', fixRes.rows);
    } else {
        // Fallback: manual sequence update
        const maxIdRes = await client.query('SELECT MAX(id) FROM orders');
        const maxId = maxIdRes.rows[0].max;
        console.log('Max ID in orders:', maxId);
        
        // try common sequence names
        const sequences = ['orders_id_seq', 'orders_new_id_seq'];
        for (const seq of sequences) {
            try {
                await client.query(`SELECT setval('${seq}', ${maxId});`);
                console.log(`Successfully updated sequence ${seq} to ${maxId}`);
                break;
            } catch (e) {
                console.log(`Sequence ${seq} failed: ${e.message}`);
            }
        }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

main();
