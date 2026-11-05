import { createHash } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { pool } from './database.js';
import { createSessionToken, hashSessionToken, parseCookies, verifyPassword } from './security.js';

const SESSION_COOKIE = 'cybersandbox_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const MAX_BODY_BYTES = 16 * 1024;

type LoginRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: 'student' | 'lecturer' | 'institution_admin' | 'platform_admin' | 'lab_operator';
};

function send(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'cross-origin-resource-policy': 'same-origin',
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > MAX_BODY_BYTES) throw Object.assign(new Error('Request body too large.'), { statusCode: 413 });
    chunks.push(buffer);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Malformed JSON request body.'), { statusCode: 400 }); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Object.assign(new Error('A JSON object is required.'), { statusCode: 400 });
  return parsed as Record<string, unknown>;
}

function setSessionCookie(response: ServerResponse, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('set-cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
}

function clearSessionCookie(response: ServerResponse): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function requestKey(request: IncomingMessage, email: string): string {
  const address = request.socket.remoteAddress ?? 'unknown';
  return createHash('sha256').update(`${address}:${email}`).digest('hex');
}

async function login(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readJson(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const institutionSlug = typeof body.institutionSlug === 'string' ? body.institutionSlug.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 1024 || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(institutionSlug)) {
    send(response, 400, { error: 'Enter a valid institutional email, password, and institution code.' });
    return;
  }

  const key = requestKey(request, email);
  const throttle = await pool.query('SELECT blocked_until FROM auth_login_attempts WHERE attempt_key = $1', [key]);
  if (throttle.rows[0]?.blocked_until && new Date(throttle.rows[0].blocked_until).getTime() > Date.now()) {
    send(response, 429, { error: 'Too many sign-in attempts. Try again later.' });
    return;
  }

  const result = await pool.query<LoginRow>(
    `SELECT u.id, u.email, u.display_name, u.password_hash,
            o.id AS organization_id, o.name AS organization_name, o.slug AS organization_slug,
            m.role
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
       JOIN organizations o ON o.id = m.organization_id AND o.status = 'active'
      WHERE lower(u.email) = $1 AND o.slug = $2 AND u.status = 'active'
      LIMIT 1`,
    [email, institutionSlug],
  );
  const user = result.rows[0];
  const valid = user ? await verifyPassword(password, user.password_hash) : false;
  if (!valid || !user) {
    await pool.query(
      `INSERT INTO auth_login_attempts (attempt_key, failures, window_started, blocked_until)
       VALUES ($1, 1, now(), NULL)
       ON CONFLICT (attempt_key) DO UPDATE SET
         failures = CASE WHEN auth_login_attempts.window_started < now() - interval '15 minutes' THEN 1 ELSE auth_login_attempts.failures + 1 END,
         window_started = CASE WHEN auth_login_attempts.window_started < now() - interval '15 minutes' THEN now() ELSE auth_login_attempts.window_started END,
         blocked_until = CASE
           WHEN (CASE WHEN auth_login_attempts.window_started < now() - interval '15 minutes' THEN 1 ELSE auth_login_attempts.failures + 1 END) >= 8
           THEN now() + interval '15 minutes' ELSE NULL END`,
      [key],
    );
    send(response, 401, { error: 'The sign-in details could not be verified.' });
    return;
  }

  await pool.query('DELETE FROM auth_login_attempts WHERE attempt_key = $1', [key]);
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  await pool.query(
    'INSERT INTO sessions (token_hash, user_id, organization_id, expires_at) VALUES ($1, $2, $3, now() + ($4 * interval \'1 second\'))',
    [tokenHash, user.id, user.organization_id, SESSION_TTL_SECONDS],
  );
  setSessionCookie(response, token);
  send(response, 200, {
    user: { id: user.id, email: user.email, displayName: user.display_name },
    institution: { id: user.organization_id, name: user.organization_name, slug: user.organization_slug },
    role: user.role,
    expiresIn: SESSION_TTL_SECONDS,
  });
}

async function currentSession(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token || token.length > 128) {
    send(response, 401, { error: 'Authentication required.' });
    return;
  }
  const result = await pool.query(
    `SELECT u.id, u.email, u.display_name, o.id AS organization_id,
            o.name AS organization_name, o.slug AS organization_slug, m.role,
            s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.status = 'active'
       JOIN organizations o ON o.id = s.organization_id AND o.status = 'active'
       JOIN memberships m ON m.user_id = u.id AND m.organization_id = o.id AND m.status = 'active'
      WHERE s.token_hash = $1 AND s.expires_at > now()
      LIMIT 1`,
    [hashSessionToken(token)],
  );
  const session = result.rows[0];
  if (!session) {
    clearSessionCookie(response);
    send(response, 401, { error: 'Session expired or no longer authorized.' });
    return;
  }
  send(response, 200, {
    user: { id: session.id, email: session.email, displayName: session.display_name },
    institution: { id: session.organization_id, name: session.organization_name, slug: session.organization_slug },
    role: session.role,
    expiresAt: session.expires_at,
  });
}

async function logout(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (token && token.length <= 128) {
    await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashSessionToken(token)]);
  }
  clearSessionCookie(response);
  send(response, 200, { ok: true });
}

export function createApiServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const origin = request.headers.origin;
      const allowedOrigin = process.env.APP_ORIGIN;
      if (origin && allowedOrigin && origin !== allowedOrigin) {
        send(response, 403, { error: 'Cross-origin request rejected.' });
        return;
      }
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'cache-control': 'no-store' });
        response.end();
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        await pool.query('SELECT 1');
        send(response, 200, { status: 'ok', service: 'cybersandbox-api' });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/login') return await login(request, response);
      if (request.method === 'GET' && url.pathname === '/api/auth/session') return await currentSession(request, response);
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') return await logout(request, response);
      send(response, 404, { error: 'Route not found.' });
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode: unknown }).statusCode) : 500;
      if (status >= 500) console.error('API request failed', error);
      send(response, status, { error: status >= 500 ? 'An internal error occurred.' : (error instanceof Error ? error.message : 'Invalid request.') });
    }
  });
}
