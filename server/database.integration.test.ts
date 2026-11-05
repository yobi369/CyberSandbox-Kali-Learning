import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const integration = describe.skipIf(!databaseUrl);

integration('PostgreSQL institution row-level security', () => {
  const admin = new Pool({ connectionString: databaseUrl, max: 2 });

  afterAll(async () => { await admin.end(); });

  it('isolates two institutions and rejects writes across the active tenant boundary', async () => {
    await admin.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cybersandbox_rls_test') THEN
          CREATE ROLE cybersandbox_rls_test NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
        END IF;
      END $$;
    `);
    await admin.query('GRANT USAGE ON SCHEMA public TO cybersandbox_rls_test');
    await admin.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cybersandbox_rls_test');
    await admin.query('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cybersandbox_rls_test');

    const orgA = randomUUID();
    const orgB = randomUUID();
    const courseB = randomUUID();
    await admin.query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)', [
      orgA, 'Isolation Test A', 'isolation-test-a-' + orgA.slice(0, 8),
      orgB, 'Isolation Test B', 'isolation-test-b-' + orgB.slice(0, 8),
    ]);
    await admin.query(
      "INSERT INTO courses (id, organization_id, code, title, level) VALUES ($1, $2, 'SEC-B', 'Tenant B course', 'undergraduate')",
      [courseB, orgB],
    );

    const client = await admin.connect();
    try {
      await client.query('SET ROLE cybersandbox_rls_test');
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_organization_id', $1, true)", [orgA]);
      const visible = await client.query('SELECT id FROM courses WHERE id = $1', [courseB]);
      expect(visible.rowCount).toBe(0);

      await expect(client.query(
        "INSERT INTO courses (organization_id, code, title, level) VALUES ($1, 'FORBIDDEN', 'Cross tenant write', 'undergraduate')",
        [orgB],
      )).rejects.toThrow(/row-level security/i);
      await client.query('ROLLBACK');
      await client.query('RESET ROLE');
    } finally {
      try { await client.query('ROLLBACK'); await client.query('RESET ROLE'); } catch { /* connection cleanup */ }
      client.release();
      await admin.query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [[orgA, orgB]]);
    }
  });
});
