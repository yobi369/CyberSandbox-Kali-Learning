import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiServer } from './app.js';
import { pool } from './database.js';
import { hashPassword } from './security.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for PostgreSQL integration tests. Run them with npm test.');
}

const allowedOrigin = 'https://cybersandbox-demo.pages.dev';
let server: ReturnType<typeof createApiServer>;
let baseUrl = '';

describe('public deployment readiness', () => {
  beforeAll(async () => {
    process.env.APP_ORIGIN = allowedOrigin;
    server = createApiServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test API did not bind to a TCP port.');
    baseUrl = 'http://127.0.0.1:' + address.port;
  });

  afterAll(async () => {
    if (server?.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  });

  it('reports database connectivity and all schema migrations', async () => {
    const response = await fetch(baseUrl + '/health');
    expect(response.status).toBe(200);
    const body = await response.json() as { status: string; database: string; migrations: number };
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(body.migrations).toBeGreaterThanOrEqual(3);
  });

  it('allows credentialed browser preflight only from the configured frontend origin', async () => {
    const allowed = await fetch(baseUrl + '/api/auth/login', {
      method: 'OPTIONS',
      headers: { Origin: allowedOrigin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true');

    const rejected = await fetch(baseUrl + '/health', { headers: { Origin: 'https://attacker.example' } });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('authenticates a synthetic institution admin and establishes a session cookie', async () => {
    const id = randomUUID();
    const slug = 'deploy-check-' + id.slice(0, 8);
    const email = 'deploy-check-' + id + '@example.test';
    const password = 'Demo-check-password-' + id;
    const passwordHash = await hashPassword(password);
    try {
      const organization = await pool.query(
        'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
        ['Deployment check ' + id.slice(0, 8), slug],
      );
      const user = await pool.query(
        'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id',
        [email, 'Synthetic deployment checker', passwordHash],
      );
      await pool.query(
        "INSERT INTO memberships (user_id, organization_id, role, status) VALUES ($1, $2, 'institution_admin', 'active')",
        [user.rows[0].id, organization.rows[0].id],
      );

      const login = await fetch(baseUrl + '/api/auth/login', {
        method: 'POST',
        headers: { Origin: allowedOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionSlug: slug, email, password }),
      });
      expect(login.status).toBe(200);
      expect(login.headers.get('access-control-allow-credentials')).toBe('true');
      const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
      expect(cookie).toContain('cybersandbox_session=');

      const session = await fetch(baseUrl + '/api/auth/session', {
        headers: { Origin: allowedOrigin, Cookie: cookie ?? '' },
      });
      expect(session.status).toBe(200);
      const sessionBody = await session.json() as { institution: { slug: string }; role: string };
      expect(sessionBody.institution.slug).toBe(slug);
      expect(sessionBody.role).toBe('institution_admin');

      const unauthenticated = await fetch(baseUrl + '/api/dashboard');
      expect(unauthenticated.status).toBe(401);
    } finally {
      await pool.query('DELETE FROM organizations WHERE slug = $1', [slug]);
      await pool.query('DELETE FROM users WHERE email = $1', [email]);
    }
  });
});
