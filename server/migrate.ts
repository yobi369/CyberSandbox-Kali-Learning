import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool } from './database.js';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const version = '001_university_core';
  const applied = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
  if (applied.rowCount) {
    console.log(`Migration ${version} already applied.`);
  } else {
    const sql = await readFile(join(process.cwd(), 'db', 'migrations', '001_university_core.sql'), 'utf8');
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
    console.log(`Applied migration ${version}.`);
  }
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
