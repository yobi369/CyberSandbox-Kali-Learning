import { Pool, PoolClient } from 'pg';

const databaseSslEnabled = process.env.DATABASE_SSL === 'true';
const databaseSslCa = process.env.DATABASE_SSL_CA_BASE64
  ? Buffer.from(process.env.DATABASE_SSL_CA_BASE64, 'base64').toString('utf8')
  : undefined;

if (databaseSslEnabled && process.env.NODE_ENV === 'production' && !databaseSslCa) {
  throw new Error('DATABASE_SSL_CA_BASE64 is required for verified production database TLS.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: databaseSslEnabled ? { rejectUnauthorized: true, ...(databaseSslCa ? { ca: databaseSslCa } : {}) } : undefined,
});

export async function withInstitution<T>(
  institutionId: string,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_organization_id', $1, true)", [institutionId]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
