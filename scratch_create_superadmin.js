import { Client } from 'pg';
import * as bcrypt from 'bcryptjs';

const connectionString = 'postgresql://neondb_owner:npg_jN60JTnhYWqi@ep-fragrant-math-axaqvx9u-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  const email = 'aftabfarhan324@gmail.com';
  const rawPassword = 'SuperAdminSecretPassword123!';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);
  
  console.log('Inserting or updating Superadmin user...');

  // Ensure table exists or insert
  const res = await client.query(`
    INSERT INTO superadmin (id, name, email, password, designation, permissions, "createdAt", "updatedAt")
    VALUES (
      gen_random_uuid(),
      'Aftab Farhan',
      $1,
      $2,
      'Super Admin',
      '[]'::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (email) 
    DO UPDATE SET password = $2, "updatedAt" = NOW()
    RETURNING id, name, email;
  `, [email, hashedPassword]);

  console.log('✅ Superadmin created/updated successfully:', res.rows[0]);
  console.log('--------------------------------------------------');
  console.log(`Email: ${email}`);
  console.log(`Password: ${rawPassword}`);
  console.log('--------------------------------------------------');

  await client.end();
}

run().catch(err => {
  console.error('Error inserting superadmin:', err);
  process.exit(1);
});
