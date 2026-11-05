import { pool } from './database.js';
import { hashPassword } from './security.js';

const name = process.env.BOOTSTRAP_INSTITUTION_NAME?.trim() ?? '';
const slug = process.env.BOOTSTRAP_INSTITUTION_SLUG?.trim().toLowerCase() ?? '';
const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
const displayName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() ?? '';
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
if (name.length < 2 || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length < 2 ||
    password.length < 12 || password.length > 1024) {
  throw new Error('Set valid BOOTSTRAP_INSTITUTION_NAME, BOOTSTRAP_INSTITUTION_SLUG, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, and a 12+ character BOOTSTRAP_ADMIN_PASSWORD.');
}

const passwordHash = await hashPassword(password);
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const institution = await client.query(
    'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
    [name, slug],
  );
  const user = await client.query(
    'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [email, displayName, passwordHash],
  );
  await client.query(
    "INSERT INTO memberships (user_id, organization_id, role, status) VALUES ($1, $2, 'institution_admin', 'active')",
    [user.rows[0].id, institution.rows[0].id],
  );
  await client.query('COMMIT');
  console.log(`Provisioned initial administrator for institution ${slug}. Do not reuse the bootstrap password.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
