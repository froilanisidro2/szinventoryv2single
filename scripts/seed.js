/**
 * Seed script — run once on first deploy to create the initial company and admin account.
 * Usage: npm run seed
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

const ADMIN_ROLE_NAME = 'admin';

async function seed() {
  const client = new Client({
    host:     process.env.DATABASE_HOST     || 'localhost',
    port:     parseInt(process.env.DATABASE_PORT || '5436'),
    database: process.env.DATABASE_NAME     || 'szinventoryv2single',
    user:     process.env.DATABASE_USERNAME || 'szinventoryv2single',
    password: process.env.DATABASE_PASSWORD,
    ssl:      process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log('Connected to database.');

  try {
    // ── 1. Resolve the company ID ─────────────────────────────────────────────
    const companyId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID || randomUUID();

    // ── 2. Upsert company ─────────────────────────────────────────────────────
    const companyName    = process.env.SEED_COMPANY_NAME     || 'My Company';
    const companyEmail   = process.env.SEED_COMPANY_EMAIL    || 'admin@mycompany.com';
    const companyPhone   = process.env.SEED_COMPANY_PHONE    || '';
    const companyAddress = process.env.SEED_COMPANY_ADDRESS  || '';
    const companyCity    = process.env.SEED_COMPANY_CITY     || '';
    const companyCountry = process.env.SEED_COMPANY_COUNTRY  || 'Philippines';
    const currencyCode   = process.env.SEED_COMPANY_CURRENCY || 'PHP';

    const companyRes = await client.query(
      `INSERT INTO companies (id, name, email, phone, address, city, country, currency_code, status, plan_type, subscription_status, user_limit)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', 'starter', 'active', 999)
       ON CONFLICT (id) DO UPDATE SET
         name           = EXCLUDED.name,
         email          = EXCLUDED.email,
         phone          = EXCLUDED.phone,
         address        = EXCLUDED.address,
         city           = EXCLUDED.city,
         country        = EXCLUDED.country,
         currency_code  = EXCLUDED.currency_code,
         updated_at     = NOW()
       RETURNING id, name`,
      [companyId, companyName, companyEmail, companyPhone, companyAddress, companyCity, companyCountry, currencyCode]
    );
    console.log(`Company: "${companyRes.rows[0].name}" (${companyRes.rows[0].id})`);

    // ── 3. Resolve admin role id ──────────────────────────────────────────────
    const roleRes = await client.query(
      `SELECT id FROM roles WHERE name = $1 LIMIT 1`,
      [ADMIN_ROLE_NAME]
    );
    if (roleRes.rows.length === 0) {
      throw new Error(`Role "${ADMIN_ROLE_NAME}" not found. Run 01_schema.sql first.`);
    }
    const roleId = roleRes.rows[0].id;

    // ── 4. Upsert admin user ──────────────────────────────────────────────────
    const adminEmail    = process.env.SEED_ADMIN_EMAIL      || 'admin@mycompany.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD   || 'Admin@12345';
    const adminFirst    = process.env.SEED_ADMIN_FIRST_NAME || 'Admin';
    const adminLast     = process.env.SEED_ADMIN_LAST_NAME  || 'User';

    if (adminPassword.length < 8) {
      throw new Error('SEED_ADMIN_PASSWORD must be at least 8 characters.');
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const userRes = await client.query(
      `INSERT INTO users (company_id, email, first_name, last_name, password_hash, role_id, role, status, is_company_admin)
       VALUES ($1, $2, $3, $4, $5, $6, 'admin', 'active', true)
       ON CONFLICT (company_id, email) DO UPDATE SET
         first_name       = EXCLUDED.first_name,
         last_name        = EXCLUDED.last_name,
         role_id          = EXCLUDED.role_id,
         role             = EXCLUDED.role,
         is_company_admin = true,
         status           = 'active',
         updated_at       = NOW()
       RETURNING id, email`,
      [companyId, adminEmail, adminFirst, adminLast, passwordHash, roleId]
    );
    console.log(`Admin user: "${userRes.rows[0].email}" (${userRes.rows[0].id})`);

    // ── 5. Summary ────────────────────────────────────────────────────────────
    console.log('\n✓ Seed complete.');
    console.log(`  Company ID : ${companyId}`);
    console.log(`  Login      : ${adminEmail}`);
    console.log(`  Password   : ${adminPassword}`);
    console.log('\n  Set this in your .env if not already set:');
    console.log(`  NEXT_PUBLIC_DEFAULT_COMPANY_ID=${companyId}`);

  } catch (err) {
    console.error('\n✗ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
