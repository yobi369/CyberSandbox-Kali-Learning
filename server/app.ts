import { createHash } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { pool, withInstitution } from './database.js';
import { createSessionToken, hashSessionToken, parseCookies, verifyPassword } from './security.js';

const SESSION_COOKIE = 'cybersandbox_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const MAX_BODY_BYTES = 128 * 1024;
type Role = 'student' | 'lecturer' | 'institution_admin' | 'platform_admin' | 'lab_operator';
type Session = {
  userId: string; email: string; displayName: string; organizationId: string;
  organizationName: string; organizationSlug: string; role: Role; expiresAt: string;
};
class HttpError extends Error {
  constructor(public statusCode: number, message: string) { super(message); }
}

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
    if (length > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large.');
    chunks.push(buffer);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Malformed JSON request body.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new HttpError(400, 'A JSON object is required.');
  return parsed as Record<string, unknown>;
}

function setSessionCookie(response: ServerResponse, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('set-cookie', SESSION_COOKIE + '=' + encodeURIComponent(token) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + SESSION_TTL_SECONDS + secure);
}
function clearSessionCookie(response: ServerResponse): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('set-cookie', SESSION_COOKIE + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + secure);
}
function requestKey(request: IncomingMessage, email: string): string {
  const address = request.socket.remoteAddress ?? 'unknown';
  return createHash('sha256').update(address + ':' + email).digest('hex');
}
function requireValue(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new HttpError(400, 'Invalid ' + name + '.');
  return value.trim();
}
function requireUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, 'Invalid resource identifier.');
  return value;
}
function requireRole(session: Session, allowed: Role[]): void {
  if (!allowed.includes(session.role)) throw new HttpError(403, 'Your institution role cannot perform this action.');
}
async function findSession(request: IncomingMessage): Promise<Session | null> {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token || token.length > 128) return null;
  const result = await pool.query(
    'SELECT u.id, u.email, u.display_name, o.id AS organization_id, o.name AS organization_name, o.slug AS organization_slug, m.role, s.expires_at ' +
    'FROM sessions s JOIN users u ON u.id = s.user_id AND u.status = $2 ' +
    'JOIN organizations o ON o.id = s.organization_id AND o.status = $3 ' +
    'JOIN memberships m ON m.user_id = u.id AND m.organization_id = o.id AND m.status = $4 ' +
    'WHERE s.token_hash = $1 AND s.expires_at > now() LIMIT 1',
    [hashSessionToken(token), 'active', 'active', 'active'],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    userId: row.id, email: row.email, displayName: row.display_name,
    organizationId: row.organization_id, organizationName: row.organization_name,
    organizationSlug: row.organization_slug, role: row.role, expiresAt: row.expires_at,
  };
}
async function requireSession(request: IncomingMessage): Promise<Session> {
  const session = await findSession(request);
  if (!session) throw new HttpError(401, 'Authentication required.');
  return session;
}
async function inTenant<T>(session: Session, operation: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  return withInstitution(session.organizationId, async (client) => {
    const membership = await client.query(
      'SELECT 1 FROM memberships m JOIN organizations o ON o.id = m.organization_id WHERE m.user_id = $1 AND m.organization_id = $2 AND m.status = $3 AND o.status = $4',
      [session.userId, session.organizationId, 'active', 'active'],
    );
    if (!membership.rowCount) throw new HttpError(401, 'Institution membership is no longer active.');
    return operation(client);
  });
}
async function recordAudit(client: import('pg').PoolClient, session: Session, action: string, resourceType: string, resourceId: string | null): Promise<void> {
  await client.query(
    'INSERT INTO audit_events (organization_id, actor_user_id, action, resource_type, resource_id, outcome) VALUES ($1, $2, $3, $4, $5, $6)',
    [session.organizationId, session.userId, action, resourceType, resourceId, 'success'],
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonicalJson(record[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
async function appendResearchProvenance(
  client: import('pg').PoolClient, session: Session, projectId: string,
  eventType: string, payload: unknown, experimentId: string | null = null, datasetId: string | null = null,
): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [projectId]);
  const previous = await client.query('SELECT event_hash, sequence_no FROM research_provenance WHERE organization_id = $1 AND project_id = $2 ORDER BY sequence_no DESC LIMIT 1', [session.organizationId, projectId]);
  const previousHash = previous.rows[0]?.event_hash ?? null;
  const sequenceNo = Number(previous.rows[0]?.sequence_no ?? 0) + 1;
  const payloadJson = canonicalJson(payload);
  const occurredAt = new Date().toISOString();
  const eventHash = createHash('sha256').update([previousHash ?? '', projectId, String(sequenceNo), session.userId, eventType, payloadJson, occurredAt].join('|')).digest('hex');
  await client.query(
    'INSERT INTO research_provenance (organization_id, project_id, experiment_id, dataset_id, actor_user_id, event_type, payload, sequence_no, previous_hash, event_hash, occurred_at) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)',
    [session.organizationId,projectId,experimentId,datasetId,session.userId,eventType,payloadJson,sequenceNo,previousHash,eventHash,occurredAt],
  );
}

async function lecturerCanAccessCohort(client: import('pg').PoolClient, session: Session, cohortId: string): Promise<boolean> {
  if (session.role === 'institution_admin' || session.role === 'platform_admin') return true;
  const result = await client.query(
    'SELECT 1 FROM cohort_staff WHERE organization_id = $1 AND cohort_id = $2 AND lecturer_user_id = $3',
    [session.organizationId, cohortId, session.userId],
  );
  return result.rowCount > 0;
}

async function login(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readJson(request);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const institutionSlug = typeof body.institutionSlug === 'string' ? body.institutionSlug.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 1024 || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(institutionSlug)) {
    throw new HttpError(400, 'Enter a valid institutional email, password, and institution code.');
  }
  const key = requestKey(request, email);
  const throttle = await pool.query('SELECT blocked_until FROM auth_login_attempts WHERE attempt_key = $1', [key]);
  if (throttle.rows[0]?.blocked_until && new Date(throttle.rows[0].blocked_until).getTime() > Date.now()) {
    throw new HttpError(429, 'Too many sign-in attempts. Try again later.');
  }
  const result = await pool.query(
    'SELECT u.id, u.email, u.display_name, u.password_hash, o.id AS organization_id, o.name AS organization_name, o.slug AS organization_slug, m.role ' +
    'FROM users u JOIN memberships m ON m.user_id = u.id AND m.status = $3 ' +
    'JOIN organizations o ON o.id = m.organization_id AND o.status = $4 ' +
    'WHERE lower(u.email) = $1 AND o.slug = $2 AND u.status = $5 LIMIT 1',
    [email, institutionSlug, 'active', 'active', 'active'],
  );
  const user = result.rows[0];
  const valid = user ? await verifyPassword(password, user.password_hash) : false;
  if (!valid || !user) {
    await pool.query(
      'INSERT INTO auth_login_attempts (attempt_key, failures, window_started, blocked_until) VALUES ($1, 1, now(), NULL) ' +
      'ON CONFLICT (attempt_key) DO UPDATE SET ' +
      'failures = CASE WHEN auth_login_attempts.window_started < now() - interval \'15 minutes\' THEN 1 ELSE auth_login_attempts.failures + 1 END, ' +
      'window_started = CASE WHEN auth_login_attempts.window_started < now() - interval \'15 minutes\' THEN now() ELSE auth_login_attempts.window_started END, ' +
      'blocked_until = CASE WHEN (CASE WHEN auth_login_attempts.window_started < now() - interval \'15 minutes\' THEN 1 ELSE auth_login_attempts.failures + 1 END) >= 8 THEN now() + interval \'15 minutes\' ELSE NULL END',
      [key],
    );
    throw new HttpError(401, 'The sign-in details could not be verified.');
  }
  await pool.query('DELETE FROM auth_login_attempts WHERE attempt_key = $1', [key]);
  const token = createSessionToken();
  await pool.query(
    'INSERT INTO sessions (token_hash, user_id, organization_id, expires_at) VALUES ($1, $2, $3, now() + ($4 * interval \'1 second\'))',
    [hashSessionToken(token), user.id, user.organization_id, SESSION_TTL_SECONDS],
  );
  setSessionCookie(response, token);
  send(response, 200, {
    user: { id: user.id, email: user.email, displayName: user.display_name },
    institution: { id: user.organization_id, name: user.organization_name, slug: user.organization_slug },
    role: user.role, expiresIn: SESSION_TTL_SECONDS,
  });
}
async function currentSession(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await findSession(request);
  if (!session) {
    clearSessionCookie(response);
    throw new HttpError(401, 'Session expired or no longer authorized.');
  }
  send(response, 200, {
    user: { id: session.userId, email: session.email, displayName: session.displayName },
    institution: { id: session.organizationId, name: session.organizationName, slug: session.organizationSlug },
    role: session.role, expiresAt: session.expiresAt,
  });
}
async function logout(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (token && token.length <= 128) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashSessionToken(token)]);
  clearSessionCookie(response);
  send(response, 200, { ok: true });
}

async function dashboard(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  const data = await inTenant(session, async (client) => {
    if (session.role === 'student') {
      const result = await client.query(
        'SELECT ' +
        '(SELECT count(DISTINCT c.id) FROM enrollments e JOIN cohorts h ON h.id = e.cohort_id AND h.organization_id = e.organization_id JOIN courses c ON c.id = h.course_id AND c.organization_id = h.organization_id WHERE e.organization_id = $1 AND e.student_user_id = $2 AND e.status = $3 AND h.status = $4) AS courses, ' +
        '(SELECT count(*) FROM assignments a JOIN cohorts h ON h.id = a.cohort_id AND h.organization_id = a.organization_id JOIN enrollments e ON e.cohort_id = h.id AND e.organization_id = h.organization_id WHERE a.organization_id = $1 AND e.student_user_id = $2 AND e.status = $3 AND a.status = $5 AND (a.due_at IS NULL OR a.due_at >= now())) AS due_assignments, ' +
        '(SELECT count(*) FROM submissions s WHERE s.organization_id = $1 AND s.student_user_id = $2) AS submissions, ' +
        '(SELECT count(*) FROM lesson_completions lc WHERE lc.organization_id = $1 AND lc.learner_user_id = $2) AS completed_lessons',
        [session.organizationId, session.userId, 'active', 'active', 'published'],
      );
      return { role: 'student', metrics: Object.fromEntries(Object.entries(result.rows[0]).map(([k, v]) => [k, Number(v)])) };
    }
    if (session.role === 'lecturer') {
      const result = await client.query(
        'SELECT ' +
        '(SELECT count(*) FROM cohort_staff cs JOIN cohorts h ON h.id = cs.cohort_id AND h.organization_id = cs.organization_id WHERE cs.organization_id = $1 AND cs.lecturer_user_id = $2 AND h.status = $3) AS cohorts, ' +
        '(SELECT count(*) FROM assignments a JOIN cohort_staff cs ON cs.cohort_id = a.cohort_id AND cs.organization_id = a.organization_id WHERE a.organization_id = $1 AND cs.lecturer_user_id = $2) AS assignments, ' +
        '(SELECT count(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id AND a.organization_id = s.organization_id JOIN cohort_staff cs ON cs.cohort_id = a.cohort_id AND cs.organization_id = a.organization_id WHERE s.organization_id = $1 AND cs.lecturer_user_id = $2 AND s.status IN ($4, $5)) AS awaiting_review',
        [session.organizationId, session.userId, 'active', 'submitted', 'resubmitted'],
      );
      return { role: 'lecturer', metrics: Object.fromEntries(Object.entries(result.rows[0]).map(([k, v]) => [k, Number(v)])) };
    }
    if (session.role === 'institution_admin' || session.role === 'platform_admin') {
      const result = await client.query(
        'SELECT ' +
        '(SELECT count(*) FROM memberships WHERE organization_id = $1 AND role = $2 AND status = $3) AS students, ' +
        '(SELECT count(*) FROM memberships WHERE organization_id = $1 AND role = $4 AND status = $3) AS lecturers, ' +
        '(SELECT count(*) FROM courses WHERE organization_id = $1 AND status = $5) AS published_courses, ' +
        '(SELECT count(*) FROM cohorts WHERE organization_id = $1 AND status = $6) AS active_cohorts, ' +
        '(SELECT count(*) FROM assessments WHERE organization_id = $1 AND moderation_status = $7) AS pending_moderation',
        [session.organizationId, 'student', 'active', 'lecturer', 'published', 'active', 'pending'],
      );
      return { role: 'institution_admin', metrics: Object.fromEntries(Object.entries(result.rows[0]).map(([k, v]) => [k, Number(v)])) };
    }
    throw new HttpError(403, 'This role does not have an academic dashboard.');
  });
  send(response, 200, { institution: { id: session.organizationId, name: session.organizationName }, ...data });
}

async function listCourses(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['student', 'lecturer', 'institution_admin', 'platform_admin']);
  const courses = await inTenant(session, async (client) => {
    const result = await client.query(
      'SELECT DISTINCT c.id, c.code, c.title, c.description, c.level, cv.id AS course_version_id, cv.version ' +
      'FROM courses c JOIN course_versions cv ON cv.course_id = c.id AND cv.organization_id = c.organization_id AND cv.published_at IS NOT NULL ' +
      'WHERE c.organization_id = $1 AND c.status = $2 AND ' +
      '($3 <> $4 OR EXISTS (SELECT 1 FROM enrollments e JOIN cohorts h ON h.id = e.cohort_id AND h.organization_id = e.organization_id WHERE e.organization_id = c.organization_id AND e.student_user_id = $5 AND e.status = $6 AND h.course_id = c.id)) ' +
      'AND ($3 <> $7 OR EXISTS (SELECT 1 FROM cohorts h JOIN cohort_staff cs ON cs.cohort_id = h.id AND cs.organization_id = h.organization_id WHERE h.organization_id = c.organization_id AND h.course_id = c.id AND cs.lecturer_user_id = $5)) ' +
      'ORDER BY c.code',
      [session.organizationId, 'published', session.role, 'student', session.userId, 'active', 'lecturer'],
    );
    return result.rows;
  });
  send(response, 200, { courses });
}

async function pathway(request: IncomingMessage, response: ServerResponse, courseId: string): Promise<void> {
  const session = await requireSession(request);
  requireUuid(courseId);
  const result = await inTenant(session, async (client) => {
    if (session.role === 'student') {
      const access = await client.query(
        'SELECT 1 FROM enrollments e JOIN cohorts h ON h.id = e.cohort_id AND h.organization_id = e.organization_id WHERE e.organization_id = $1 AND e.student_user_id = $2 AND e.status = $3 AND h.course_id = $4',
        [session.organizationId, session.userId, 'active', courseId],
      );
      if (!access.rowCount) throw new HttpError(403, 'Enrolment is required to view this pathway.');
    }
    if (session.role === 'lecturer') {
      const access = await client.query(
        'SELECT 1 FROM cohorts h JOIN cohort_staff cs ON cs.cohort_id = h.id AND cs.organization_id = h.organization_id WHERE h.organization_id = $1 AND h.course_id = $2 AND cs.lecturer_user_id = $3 LIMIT 1',
        [session.organizationId, courseId, session.userId],
      );
      if (!access.rowCount) throw new HttpError(403, 'You are not assigned to this course.');
    }
    const versions = await client.query(
      'SELECT id, version, title, learning_outcomes FROM course_versions WHERE organization_id = $1 AND course_id = $2 AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1',
      [session.organizationId, courseId],
    );
    if (!versions.rowCount) throw new HttpError(404, 'Published course pathway not found.');
    const version = versions.rows[0];
    const modules = await client.query(
      'SELECT m.id, m.slug, m.title, m.sequence, m.learning_outcomes, ' +
      'COALESCE(jsonb_agg(jsonb_build_object(\'id\', l.id, \'slug\', l.slug, \'title\', l.title, \'sequence\', l.sequence, \'estimatedMinutes\', l.estimated_minutes, \'completed\', (lc.id IS NOT NULL), \'prerequisites\', (SELECT COALESCE(jsonb_agg(lp.prerequisite_lesson_id), \'[]\'::jsonb) FROM lesson_prerequisites lp WHERE lp.organization_id = l.organization_id AND lp.lesson_id = l.id))) FILTER (WHERE l.id IS NOT NULL), \'[]\'::jsonb) AS lessons ' +
      'FROM learning_modules m LEFT JOIN learning_lessons l ON l.module_id = m.id AND l.organization_id = m.organization_id ' +
      'LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.organization_id = l.organization_id AND lc.learner_user_id = $3 ' +
      'WHERE m.organization_id = $1 AND m.course_version_id = $2 GROUP BY m.id ORDER BY m.sequence',
      [session.organizationId, version.id, session.userId],
    );
    return { version, modules: modules.rows };
  });
  send(response, 200, result);
}

async function enrol(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['student']);
  const body = await readJson(request);
  const cohortId = requireUuid(requireValue(body.cohortId, 'cohort identifier', 64));
  const result = await inTenant(session, async (client) => {
    const eligible = await client.query(
      'SELECT h.id FROM cohorts h JOIN courses c ON c.id = h.course_id AND c.organization_id = h.organization_id ' +
      'JOIN course_versions cv ON cv.id = h.course_version_id AND cv.organization_id = h.organization_id ' +
      'WHERE h.organization_id = $1 AND h.id = $2 AND h.status = $3 AND c.status = $4 AND cv.published_at IS NOT NULL',
      [session.organizationId, cohortId, 'active', 'published'],
    );
    if (!eligible.rowCount) throw new HttpError(404, 'The selected cohort is not open for enrolment.');
    const enrolled = await client.query(
      'INSERT INTO enrollments (organization_id, cohort_id, student_user_id, status) VALUES ($1, $2, $3, $4) ' +
      'ON CONFLICT (organization_id, cohort_id, student_user_id) DO UPDATE SET status = $4 RETURNING id',
      [session.organizationId, cohortId, session.userId, 'active'],
    );
    await recordAudit(client, session, 'enrollment.created', 'cohort', cohortId);
    return { enrollmentId: enrolled.rows[0].id };
  });
  send(response, 201, result);
}


async function listCohorts(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  const cohorts = await inTenant(session, async (client) => {
    const result = await client.query(
      'SELECT h.id, h.name, h.status, h.starts_at, h.ends_at, c.id AS course_id, c.code AS course_code, c.title AS course_title, ' +
      '(SELECT count(*) FROM enrollments e WHERE e.organization_id = h.organization_id AND e.cohort_id = h.id AND e.status = $2) AS enrolled_count ' +
      'FROM cohorts h JOIN courses c ON c.id = h.course_id AND c.organization_id = h.organization_id WHERE h.organization_id = $1 AND ' +
      '($3 NOT IN ($4,$5) OR EXISTS (SELECT 1 FROM cohort_staff cs WHERE cs.organization_id = h.organization_id AND cs.cohort_id = h.id AND cs.lecturer_user_id = $6)) ' +
      'AND ($3 <> $7 OR h.status IN ($8,$9)) ORDER BY h.starts_at NULLS LAST, h.name',
      [session.organizationId,'active',session.role,'lecturer','teaching_assistant',session.userId,'student','planned','active'],
    );
    return result.rows;
  });
  send(response, 200, { cohorts });
}

async function listSubmissions(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  const submissions = await inTenant(session, async (client) => {
    let sql = 'SELECT s.id, s.assignment_id, s.student_user_id, u.display_name AS learner, a.title AS assignment, s.status, s.submitted_at FROM submissions s JOIN users u ON u.id = s.student_user_id JOIN assignments a ON a.id = s.assignment_id AND a.organization_id = s.organization_id WHERE s.organization_id = $1';
    const params: unknown[] = [session.organizationId];
    if (session.role === 'student') { sql += ' AND s.student_user_id = $2'; params.push(session.userId); }
    else if (session.role === 'lecturer') { sql += ' AND EXISTS (SELECT 1 FROM cohort_staff cs WHERE cs.organization_id = a.organization_id AND cs.cohort_id = a.cohort_id AND cs.lecturer_user_id = $2)'; params.push(session.userId); }
    else if (!['institution_admin','platform_admin'].includes(session.role)) throw new HttpError(403, 'Role cannot view submissions.');
    sql += ' ORDER BY s.submitted_at DESC LIMIT 250';
    return (await client.query(sql, params)).rows;
  });
  send(response, 200, { submissions });
}

async function listPendingAssessments(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer','institution_admin','platform_admin']);
  const assessments = await inTenant(session, async (client) => {
    let sql = "SELECT a.id, a.submission_id, a.score, a.lecturer_feedback, a.assessed_by, a.assessed_at, s.student_user_id, u.display_name AS learner, ass.title AS assignment, h.name AS cohort FROM assessments a JOIN submissions s ON s.id = a.submission_id AND s.organization_id = a.organization_id JOIN users u ON u.id = s.student_user_id JOIN assignments ass ON ass.id = s.assignment_id AND ass.organization_id = s.organization_id JOIN cohorts h ON h.id = ass.cohort_id AND h.organization_id = ass.organization_id WHERE a.organization_id = $1 AND a.moderation_status = 'pending'";
    const params: unknown[] = [session.organizationId];
    if (session.role === 'lecturer') { sql += ' AND EXISTS (SELECT 1 FROM cohort_staff cs WHERE cs.organization_id = ass.organization_id AND cs.cohort_id = ass.cohort_id AND cs.lecturer_user_id = $2)'; params.push(session.userId); }
    sql += ' ORDER BY a.assessed_at ASC LIMIT 250';
    return (await client.query(sql, params)).rows;
  });
  send(response, 200, { assessments });
}

async function listGradeHistory(request: IncomingMessage, response: ServerResponse, submissionId: string): Promise<void> {
  const session = await requireSession(request);
  requireUuid(submissionId);
  const grades = await inTenant(session, async (client) => {
    const source = await client.query('SELECT s.student_user_id, a.cohort_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id AND a.organization_id = s.organization_id WHERE s.organization_id = $1 AND s.id = $2', [session.organizationId,submissionId]);
    if (!source.rowCount) throw new HttpError(404, 'Submission not found.');
    if (session.role === 'student' && source.rows[0].student_user_id !== session.userId) throw new HttpError(403, 'You cannot view another learner grade history.');
    if (session.role === 'lecturer' && !await lecturerCanAccessCohort(client,session,source.rows[0].cohort_id)) throw new HttpError(403, 'You are not assigned to this cohort.');
    if (!['student','lecturer','institution_admin','platform_admin'].includes(session.role)) throw new HttpError(403, 'Role cannot view grade history.');
    return (await client.query('SELECT gh.id, gh.grade, gh.feedback, gh.rubric_version, gh.recorded_at, u.display_name AS recorded_by FROM grade_history gh JOIN users u ON u.id = gh.recorded_by WHERE gh.organization_id = $1 AND gh.submission_id = $2 ORDER BY gh.recorded_at DESC', [session.organizationId,submissionId])).rows;
  });
  send(response, 200, { grades });
}

async function listAssignments(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  const assignments = await inTenant(session, async (client) => {
    let sql = 'SELECT a.id, a.title, a.instructions, a.due_at, a.status, a.rubric_version, h.name AS cohort_name, c.code AS course_code FROM assignments a JOIN cohorts h ON h.id = a.cohort_id AND h.organization_id = a.organization_id JOIN courses c ON c.id = h.course_id AND c.organization_id = h.organization_id WHERE a.organization_id = $1';
    const params: unknown[] = [session.organizationId];
    if (session.role === 'student') {
      sql += ' AND a.status = $2 AND EXISTS (SELECT 1 FROM enrollments e WHERE e.organization_id = a.organization_id AND e.cohort_id = a.cohort_id AND e.student_user_id = $3 AND e.status = $4)';
      params.push('published', session.userId, 'active');
    } else if (session.role === 'lecturer') {
      sql += ' AND EXISTS (SELECT 1 FROM cohort_staff cs WHERE cs.organization_id = a.organization_id AND cs.cohort_id = a.cohort_id AND cs.lecturer_user_id = $2)';
      params.push(session.userId);
    } else if (!['institution_admin', 'platform_admin'].includes(session.role)) {
      throw new HttpError(403, 'Role cannot view assignments.');
    }
    sql += ' ORDER BY a.due_at NULLS LAST, a.created_at DESC';
    const result = await client.query(sql, params);
    return result.rows;
  });
  send(response, 200, { assignments });
}

async function createAssignment(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer', 'institution_admin']);
  const body = await readJson(request);
  const cohortId = requireUuid(requireValue(body.cohortId, 'cohort identifier', 64));
  const title = requireValue(body.title, 'assignment title', 180);
  const instructions = requireValue(body.instructions, 'assignment instructions', 20000);
  if (!body.rubric || typeof body.rubric !== 'object' || Array.isArray(body.rubric)) throw new HttpError(400, 'A structured rubric is required.');
  const rubricObject = body.rubric as Record<string, unknown>;
  const criteria = rubricObject.criteria;
  if (!Array.isArray(criteria) || criteria.length < 1 || criteria.length > 20 ||
      criteria.some((item) => !item || typeof item !== 'object' || typeof (item as Record<string, unknown>).id !== 'string' ||
        !/^[a-z0-9_-]{2,48}$/i.test(String((item as Record<string, unknown>).id)) ||
        !Number.isFinite(Number((item as Record<string, unknown>).weight)) || Number((item as Record<string, unknown>).weight) <= 0)) {
    throw new HttpError(400, 'Rubric must contain 1–20 criteria with unique IDs and positive weights.');
  }
  const ids = criteria.map((item) => String((item as Record<string, unknown>).id));
  if (new Set(ids).size !== ids.length || Math.abs(criteria.reduce((sum, item) => sum + Number((item as Record<string, unknown>).weight), 0) - 100) > 0.001) {
    throw new HttpError(400, 'Rubric criterion IDs must be unique and weights must total 100.');
  }
  const rubric = JSON.stringify(rubricObject);
  if (rubric.length > 20000) throw new HttpError(400, 'Rubric is too large.');
  const dueAt = body.dueAt === undefined || body.dueAt === null ? null : new Date(requireValue(body.dueAt, 'due date', 64));
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new HttpError(400, 'Invalid due date.');
  const created = await inTenant(session, async (client) => {
    if (!await lecturerCanAccessCohort(client, session, cohortId)) throw new HttpError(403, 'You are not assigned to this cohort.');
    const result = await client.query(
      'INSERT INTO assignments (organization_id, cohort_id, title, instructions, rubric, due_at, status, created_by) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8) RETURNING id',
      [session.organizationId, cohortId, title, instructions, rubric, dueAt, 'draft', session.userId],
    );
    await recordAudit(client, session, 'assignment.created', 'assignment', result.rows[0].id);
    return { assignmentId: result.rows[0].id, status: 'draft' };
  });
  send(response, 201, created);
}

async function submitAssignment(request: IncomingMessage, response: ServerResponse, assignmentId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['student']);
  requireUuid(assignmentId);
  const body = await readJson(request);
  const submissionBody = requireValue(body.body, 'submission', 100000);
  const created = await inTenant(session, async (client) => {
    const eligible = await client.query(
      'SELECT a.id FROM assignments a JOIN enrollments e ON e.organization_id = a.organization_id AND e.cohort_id = a.cohort_id ' +
      'WHERE a.organization_id = $1 AND a.id = $2 AND a.status = $3 AND e.student_user_id = $4 AND e.status = $5 AND (a.due_at IS NULL OR a.due_at >= now())',
      [session.organizationId, assignmentId, 'published', session.userId, 'active'],
    );
    if (!eligible.rowCount) throw new HttpError(403, 'Assignment is unavailable, not published, or outside your enrolment/deadline.');
    const result = await client.query(
      'INSERT INTO submissions (organization_id, assignment_id, student_user_id, body) VALUES ($1, $2, $3, $4) RETURNING id, submitted_at',
      [session.organizationId, assignmentId, session.userId, submissionBody],
    );
    await recordAudit(client, session, 'submission.created', 'submission', result.rows[0].id);
    return { submissionId: result.rows[0].id, submittedAt: result.rows[0].submitted_at };
  });
  send(response, 201, created);
}

async function assessSubmission(request: IncomingMessage, response: ServerResponse, submissionId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer', 'institution_admin']);
  requireUuid(submissionId);
  const body = await readJson(request);
  const feedback = requireValue(body.feedback, 'lecturer feedback', 20000);
  const score = Number(body.score);
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new HttpError(400, 'Score must be between 0 and 100.');
  const assessment = await inTenant(session, async (client) => {
    const source = await client.query(
      'SELECT s.id, a.cohort_id, a.rubric_version FROM submissions s JOIN assignments a ON a.id = s.assignment_id AND a.organization_id = s.organization_id WHERE s.organization_id = $1 AND s.id = $2 FOR UPDATE OF s',
      [session.organizationId, submissionId],
    );
    if (!source.rowCount) throw new HttpError(404, 'Submission not found.');
    if (!await lecturerCanAccessCohort(client, session, source.rows[0].cohort_id)) throw new HttpError(403, 'You are not assigned to this cohort.');
    const nextVersion = await client.query('SELECT COALESCE(max(version), 0) + 1 AS version FROM assessments WHERE organization_id = $1 AND submission_id = $2', [session.organizationId, submissionId]);
    const inserted = await client.query(
      'INSERT INTO assessments (organization_id, submission_id, rubric_version, lecturer_feedback, score, assessed_by, assessed_at, version) VALUES ($1, $2, $3, $4, $5, $6, now(), $7) RETURNING id, version',
      [session.organizationId, submissionId, source.rows[0].rubric_version, feedback, score, session.userId, nextVersion.rows[0].version],
    );
    await client.query('UPDATE submissions SET status = $1 WHERE organization_id = $2 AND id = $3', ['under_review', session.organizationId, submissionId]);
    await recordAudit(client, session, 'submission.assessed', 'submission', submissionId);
    return { assessmentId: inserted.rows[0].id, version: inserted.rows[0].version, moderationStatus: 'pending' };
  });
  send(response, 201, assessment);
}

async function moderateAssessment(request: IncomingMessage, response: ServerResponse, assessmentId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer', 'institution_admin']);
  requireUuid(assessmentId);
  const body = await readJson(request);
  const decision = body.decision;
  if (!['approve', 'return', 'dispute'].includes(String(decision))) throw new HttpError(400, 'Decision must be approve, return, or dispute.');
  const result = await inTenant(session, async (client) => {
    const source = await client.query(
      'SELECT a.id, a.assessed_by, a.score, a.lecturer_feedback, a.rubric_version, s.id AS submission_id, ass.cohort_id FROM assessments a JOIN submissions s ON s.id = a.submission_id AND s.organization_id = a.organization_id JOIN assignments ass ON ass.id = s.assignment_id AND ass.organization_id = s.organization_id WHERE a.organization_id = $1 AND a.id = $2 AND a.moderation_status = $3 FOR UPDATE OF a, s',
      [session.organizationId, assessmentId, 'pending'],
    );
    if (!source.rowCount) throw new HttpError(404, 'Pending assessment not found.');
    if (source.rows[0].assessed_by === session.userId) throw new HttpError(403, 'A different lecturer or institution administrator must moderate this assessment.');
    if (!await lecturerCanAccessCohort(client, session, source.rows[0].cohort_id)) throw new HttpError(403, 'You are not assigned to this cohort.');
    const state = decision === 'approve' ? 'moderated' : decision === 'return' ? 'returned' : 'disputed';
    await client.query(
      'UPDATE assessments SET moderation_status = $1, moderated_by = $2, moderated_at = now() WHERE organization_id = $3 AND id = $4',
      [state, session.userId, session.organizationId, assessmentId],
    );
    await client.query(
      'UPDATE submissions SET status = $1 WHERE organization_id = $2 AND id = $3',
      [decision === 'approve' ? 'graded' : 'returned', session.organizationId, source.rows[0].submission_id],
    );
    if (decision === 'approve') {
      if (source.rows[0].score === null) throw new HttpError(409, 'An assessment must have a score before approval.');
      await client.query(
        'INSERT INTO grade_history (organization_id, submission_id, assessment_id, grade, feedback, rubric_version, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [session.organizationId, source.rows[0].submission_id, assessmentId, source.rows[0].score, source.rows[0].lecturer_feedback ?? '', source.rows[0].rubric_version, session.userId],
      );
    }
    await recordAudit(client, session, 'assessment.' + String(decision), 'assessment', assessmentId);
    return { assessmentId, moderationStatus: state };
  });
  send(response, 200, result);
}


async function createCourse(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin', 'platform_admin']);
  const body = await readJson(request);
  const code = requireValue(body.code, 'course code', 32).toUpperCase();
  const title = requireValue(body.title, 'course title', 180);
  const description = typeof body.description === 'string' ? body.description.slice(0, 5000) : '';
  const level = body.level;
  if (!['undergraduate', 'postgraduate', 'professional'].includes(String(level))) throw new HttpError(400, 'Invalid course level.');
  const outcomes = Array.isArray(body.learningOutcomes) ? body.learningOutcomes : [];
  if (outcomes.length > 30 || outcomes.some((x) => typeof x !== 'string' || !x.trim() || x.length > 500)) throw new HttpError(400, 'Learning outcomes must be up to 30 concise strings.');
  const created = await inTenant(session, async (client) => {
    const course = await client.query(
      'INSERT INTO courses (organization_id, code, title, description, level) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [session.organizationId, code, title, description, level],
    );
    const version = await client.query(
      'INSERT INTO course_versions (organization_id, course_id, version, title, learning_outcomes, created_by) VALUES ($1, $2, 1, $3, $4::jsonb, $5) RETURNING id',
      [session.organizationId, course.rows[0].id, title, JSON.stringify(outcomes), session.userId],
    );
    await recordAudit(client, session, 'course.created', 'course', course.rows[0].id);
    return { courseId: course.rows[0].id, courseVersionId: version.rows[0].id, status: 'draft' };
  });
  send(response, 201, created);
}

async function publishCourse(request: IncomingMessage, response: ServerResponse, courseId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin', 'platform_admin']);
  requireUuid(courseId);
  const published = await inTenant(session, async (client) => {
    const course = await client.query('SELECT id, status FROM courses WHERE organization_id = $1 AND id = $2 FOR UPDATE', [session.organizationId, courseId]);
    if (!course.rowCount) throw new HttpError(404, 'Course not found.');
    const version = await client.query('SELECT id FROM course_versions WHERE organization_id = $1 AND course_id = $2 AND published_at IS NULL ORDER BY version DESC LIMIT 1', [session.organizationId, courseId]);
    if (!version.rowCount) throw new HttpError(409, 'No unpublished course version is available.');
    const lessons = await client.query('SELECT count(*)::int AS count FROM learning_lessons l JOIN learning_modules m ON m.id = l.module_id AND m.organization_id = l.organization_id WHERE l.organization_id = $1 AND m.course_version_id = $2', [session.organizationId, version.rows[0].id]);
    if (Number(lessons.rows[0].count) === 0) throw new HttpError(409, 'A course needs at least one lesson before publication.');
    await client.query('UPDATE course_versions SET published_at = now() WHERE organization_id = $1 AND id = $2', [session.organizationId, version.rows[0].id]);
    await client.query("UPDATE courses SET status = 'published' WHERE organization_id = $1 AND id = $2", [session.organizationId, courseId]);
    await recordAudit(client, session, 'course.published', 'course', courseId);
    return { courseId, courseVersionId: version.rows[0].id, status: 'published' };
  });
  send(response, 200, published);
}



async function activateCohort(request: IncomingMessage, response: ServerResponse, cohortId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin','platform_admin']);
  requireUuid(cohortId);
  const result = await inTenant(session, async (client) => {
    const cohort = await client.query("UPDATE cohorts SET status = 'active' WHERE organization_id = $1 AND id = $2 AND status = 'planned' RETURNING id, status", [session.organizationId,cohortId]);
    if (!cohort.rowCount) throw new HttpError(404, 'Planned cohort not found.');
    await recordAudit(client,session,'cohort.activated','cohort',cohortId);
    return cohort.rows[0];
  });
  send(response,200,result);
}

async function listAdminCourses(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session,['institution_admin','platform_admin']);
  const courses = await inTenant(session,async(client)=>{
    return (await client.query(
      'SELECT c.id,c.code,c.title,c.description,c.level,c.status,cv.id AS course_version_id,cv.version,cv.published_at FROM courses c JOIN course_versions cv ON cv.course_id = c.id AND cv.organization_id = c.organization_id WHERE c.organization_id = $1 ORDER BY c.created_at DESC,cv.version DESC',
      [session.organizationId],
    )).rows;
  });
  send(response,200,{courses});
}

async function listCourseModules(request: IncomingMessage, response: ServerResponse, courseId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session,['institution_admin','platform_admin']);
  requireUuid(courseId);
  const modules = await inTenant(session,async(client)=>{
    return (await client.query(
      'SELECT m.id,m.slug,m.title,m.sequence,m.course_version_id,cv.version,cv.published_at FROM learning_modules m JOIN course_versions cv ON cv.id = m.course_version_id AND cv.organization_id = m.organization_id WHERE m.organization_id = $1 AND cv.course_id = $2 ORDER BY cv.version DESC,m.sequence',
      [session.organizationId,courseId],
    )).rows;
  });
  send(response,200,{modules});
}

async function createCourseModule(request: IncomingMessage, response: ServerResponse, courseId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin', 'platform_admin']);
  requireUuid(courseId);
  const body = await readJson(request);
  const slug = requireValue(body.slug, 'module slug', 80).toLowerCase();
  const title = requireValue(body.title, 'module title', 180);
  const sequence = Number(body.sequence);
  const outcomes = Array.isArray(body.learningOutcomes) ? body.learningOutcomes : [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(sequence) || sequence < 1 || sequence > 200 || outcomes.length > 30 || outcomes.some((x) => typeof x !== 'string' || !x.trim() || x.length > 500)) throw new HttpError(400, 'Invalid module slug, sequence, or learning outcomes.');
  const result = await inTenant(session, async (client) => {
    const version = await client.query('SELECT id FROM course_versions WHERE organization_id = $1 AND course_id = $2 AND published_at IS NULL ORDER BY version DESC LIMIT 1', [session.organizationId, courseId]);
    if (!version.rowCount) throw new HttpError(404, 'An unpublished course version was not found.');
    const module = await client.query('INSERT INTO learning_modules (organization_id, course_version_id, slug, title, sequence, learning_outcomes) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id', [session.organizationId,version.rows[0].id,slug,title,sequence,JSON.stringify(outcomes)]);
    await recordAudit(client, session, 'course.module_created', 'learning_module', module.rows[0].id);
    return { moduleId: module.rows[0].id };
  });
  send(response, 201, result);
}

async function createModuleLesson(request: IncomingMessage, response: ServerResponse, moduleId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin', 'platform_admin']);
  requireUuid(moduleId);
  const body = await readJson(request);
  const slug = requireValue(body.slug, 'lesson slug', 80).toLowerCase();
  const title = requireValue(body.title, 'lesson title', 180);
  const sequence = Number(body.sequence);
  const estimatedMinutes = Number(body.estimatedMinutes ?? 30);
  const content = body.content && typeof body.content === 'object' && !Array.isArray(body.content) ? JSON.stringify(body.content) : '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(sequence) || sequence < 1 || sequence > 500 || !Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 600 || !content || content.length > 50000) throw new HttpError(400, 'Invalid lesson content, slug, sequence, or duration.');
  const result = await inTenant(session, async (client) => {
    const module = await client.query('SELECT m.id FROM learning_modules m JOIN course_versions cv ON cv.id = m.course_version_id AND cv.organization_id = m.organization_id WHERE m.organization_id = $1 AND m.id = $2 AND cv.published_at IS NULL', [session.organizationId,moduleId]);
    if (!module.rowCount) throw new HttpError(404, 'An editable course module was not found.');
    const lesson = await client.query('INSERT INTO learning_lessons (organization_id, module_id, slug, title, sequence, content, estimated_minutes) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING id', [session.organizationId,moduleId,slug,title,sequence,content,estimatedMinutes]);
    await recordAudit(client, session, 'course.lesson_created', 'learning_lesson', lesson.rows[0].id);
    return { lessonId: lesson.rows[0].id };
  });
  send(response, 201, result);
}

async function addLessonPrerequisite(request: IncomingMessage, response: ServerResponse, lessonId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin', 'platform_admin']);
  requireUuid(lessonId);
  const body = await readJson(request);
  const prerequisiteId = requireUuid(requireValue(body.prerequisiteLessonId, 'prerequisite lesson identifier', 64));
  if (prerequisiteId === lessonId) throw new HttpError(400, 'A lesson cannot be its own prerequisite.');
  const result = await inTenant(session, async (client) => {
    const sameVersion = await client.query(
      'SELECT 1 FROM learning_lessons l JOIN learning_modules lm ON lm.id = l.module_id AND lm.organization_id = l.organization_id JOIN learning_lessons p ON p.id = $3 AND p.organization_id = l.organization_id JOIN learning_modules pm ON pm.id = p.module_id AND pm.organization_id = p.organization_id WHERE l.organization_id = $1 AND l.id = $2 AND lm.course_version_id = pm.course_version_id',
      [session.organizationId,lessonId,prerequisiteId],
    );
    if (!sameVersion.rowCount) throw new HttpError(400, 'Prerequisites must belong to the same course version.');
    const cycle = await client.query(
      'WITH RECURSIVE ancestors(id) AS (SELECT prerequisite_lesson_id FROM lesson_prerequisites WHERE organization_id = $1 AND lesson_id = $2 UNION SELECT lp.prerequisite_lesson_id FROM lesson_prerequisites lp JOIN ancestors a ON lp.lesson_id = a.id WHERE lp.organization_id = $1) SELECT 1 FROM ancestors WHERE id = $3 LIMIT 1',
      [session.organizationId,prerequisiteId,lessonId],
    );
    if (cycle.rowCount) throw new HttpError(409, 'This prerequisite would create a learning-path cycle.');
    await client.query('INSERT INTO lesson_prerequisites (organization_id, lesson_id, prerequisite_lesson_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [session.organizationId,lessonId,prerequisiteId]);
    await recordAudit(client, session, 'course.prerequisite_added', 'learning_lesson', lessonId);
    return { lessonId, prerequisiteLessonId: prerequisiteId };
  });
  send(response, 200, result);
}

async function createCohort(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin', 'platform_admin']);
  const body = await readJson(request);
  const courseId = requireUuid(requireValue(body.courseId, 'course identifier', 64));
  const name = requireValue(body.name, 'cohort name', 120);
  const startsAt = body.startsAt ? new Date(requireValue(body.startsAt, 'start date', 64)) : null;
  const endsAt = body.endsAt ? new Date(requireValue(body.endsAt, 'end date', 64)) : null;
  if ((startsAt && Number.isNaN(startsAt.getTime())) || (endsAt && Number.isNaN(endsAt.getTime())) || (startsAt && endsAt && endsAt <= startsAt)) throw new HttpError(400, 'Invalid cohort date range.');
  const cohort = await inTenant(session, async (client) => {
    const version = await client.query('SELECT id FROM course_versions WHERE organization_id = $1 AND course_id = $2 AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1', [session.organizationId, courseId]);
    if (!version.rowCount) throw new HttpError(409, 'Publish a course version before creating its cohort.');
    const result = await client.query(
      'INSERT INTO cohorts (organization_id, course_id, course_version_id, name, starts_at, ends_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [session.organizationId, courseId, version.rows[0].id, name, startsAt, endsAt, 'planned'],
    );
    await recordAudit(client, session, 'cohort.created', 'cohort', result.rows[0].id);
    return { cohortId: result.rows[0].id, status: 'planned' };
  });
  send(response, 201, cohort);
}

async function assignLecturer(request: IncomingMessage, response: ServerResponse, cohortId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin', 'platform_admin']);
  requireUuid(cohortId);
  const body = await readJson(request);
  const lecturerId = requireUuid(requireValue(body.lecturerUserId, 'lecturer user identifier', 64));
  const staffRole = body.staffRole ?? 'lecturer';
  if (!['lead', 'lecturer', 'teaching_assistant'].includes(String(staffRole))) throw new HttpError(400, 'Invalid teaching role.');
  const result = await inTenant(session, async (client) => {
    const cohort = await client.query('SELECT id FROM cohorts WHERE organization_id = $1 AND id = $2', [session.organizationId, cohortId]);
    if (!cohort.rowCount) throw new HttpError(404, 'Cohort not found.');
    const lecturer = await client.query("SELECT 1 FROM memberships WHERE organization_id = $1 AND user_id = $2 AND role = 'lecturer' AND status = 'active'", [session.organizationId, lecturerId]);
    if (!lecturer.rowCount) throw new HttpError(400, 'The selected user is not an active lecturer in this institution.');
    await client.query('INSERT INTO cohort_staff (organization_id, cohort_id, lecturer_user_id, staff_role) VALUES ($1, $2, $3, $4) ON CONFLICT (organization_id, cohort_id, lecturer_user_id) DO UPDATE SET staff_role = EXCLUDED.staff_role', [session.organizationId, cohortId, lecturerId, staffRole]);
    await recordAudit(client, session, 'cohort.lecturer_assigned', 'cohort', cohortId);
    return { cohortId, lecturerUserId: lecturerId, staffRole };
  });
  send(response, 200, result);
}

async function publishAssignment(request: IncomingMessage, response: ServerResponse, assignmentId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer', 'institution_admin']);
  requireUuid(assignmentId);
  const result = await inTenant(session, async (client) => {
    const assignment = await client.query('SELECT id, cohort_id, status, due_at FROM assignments WHERE organization_id = $1 AND id = $2 FOR UPDATE', [session.organizationId, assignmentId]);
    if (!assignment.rowCount) throw new HttpError(404, 'Assignment not found.');
    if (!await lecturerCanAccessCohort(client, session, assignment.rows[0].cohort_id)) throw new HttpError(403, 'You are not assigned to this cohort.');
    if (assignment.rows[0].status !== 'draft') throw new HttpError(409, 'Only draft assignments can be published.');
    if (assignment.rows[0].due_at && new Date(assignment.rows[0].due_at).getTime() <= Date.now()) throw new HttpError(400, 'Due date must be in the future.');
    await client.query("UPDATE assignments SET status = 'published' WHERE organization_id = $1 AND id = $2", [session.organizationId, assignmentId]);
    await recordAudit(client, session, 'assignment.published', 'assignment', assignmentId);
    return { assignmentId, status: 'published' };
  });
  send(response, 200, result);
}

async function completeLesson(request: IncomingMessage, response: ServerResponse, lessonId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['student']);
  requireUuid(lessonId);
  const body = await readJson(request);
  const evidence = body.evidence === undefined ? {} : body.evidence;
  const encoded = JSON.stringify(evidence);
  if (encoded.length > 10000) throw new HttpError(400, 'Lesson evidence is too large.');
  const result = await inTenant(session, async (client) => {
    const lesson = await client.query(
      'SELECT l.id, m.course_version_id, cv.course_id FROM learning_lessons l JOIN learning_modules m ON m.id = l.module_id AND m.organization_id = l.organization_id JOIN course_versions cv ON cv.id = m.course_version_id AND cv.organization_id = m.organization_id WHERE l.organization_id = $1 AND l.id = $2 AND cv.published_at IS NOT NULL',
      [session.organizationId, lessonId],
    );
    if (!lesson.rowCount) throw new HttpError(404, 'Published lesson not found.');
    const enrollment = await client.query(
      'SELECT 1 FROM cohorts h JOIN enrollments e ON e.cohort_id = h.id AND e.organization_id = h.organization_id WHERE h.organization_id = $1 AND h.course_id = $2 AND h.course_version_id = $3 AND h.status IN ($4, $5) AND e.student_user_id = $6 AND e.status = $7 LIMIT 1',
      [session.organizationId, lesson.rows[0].course_id, lesson.rows[0].course_version_id, 'active', 'completed', session.userId, 'active'],
    );
    if (!enrollment.rowCount) throw new HttpError(403, 'An active enrolment in this course version is required.');
    const prerequisites = await client.query(
      'SELECT lp.prerequisite_lesson_id FROM lesson_prerequisites lp LEFT JOIN lesson_completions lc ON lc.lesson_id = lp.prerequisite_lesson_id AND lc.organization_id = lp.organization_id AND lc.learner_user_id = $3 WHERE lp.organization_id = $1 AND lp.lesson_id = $2 AND lc.id IS NULL',
      [session.organizationId, lessonId, session.userId],
    );
    if (prerequisites.rowCount) throw new HttpError(409, 'Complete all prerequisite lessons first.');
    const completion = await client.query(
      'INSERT INTO lesson_completions (organization_id, lesson_id, learner_user_id, evidence) VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (organization_id, lesson_id, learner_user_id) DO UPDATE SET evidence = EXCLUDED.evidence, completed_at = now() RETURNING id, completed_at',
      [session.organizationId, lessonId, session.userId, encoded],
    );
    await recordAudit(client, session, 'lesson.completed', 'lesson', lessonId);
    return { completionId: completion.rows[0].id, completedAt: completion.rows[0].completed_at };
  });
  send(response, 200, result);
}

async function createAppeal(request: IncomingMessage, response: ServerResponse, submissionId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['student']);
  requireUuid(submissionId);
  const body = await readJson(request);
  const reason = requireValue(body.reason, 'appeal reason', 10000);
  if (reason.length < 20) throw new HttpError(400, 'Explain the appeal in at least 20 characters.');
  const result = await inTenant(session, async (client) => {
    const submission = await client.query("SELECT id FROM submissions WHERE organization_id = $1 AND id = $2 AND student_user_id = $3 AND status = 'graded'", [session.organizationId, submissionId, session.userId]);
    if (!submission.rowCount) throw new HttpError(404, 'A graded submission belonging to you was not found.');
    const existing = await client.query("SELECT id FROM grade_appeals WHERE organization_id = $1 AND submission_id = $2 AND status IN ('open','under_review')", [session.organizationId, submissionId]);
    if (existing.rowCount) throw new HttpError(409, 'An active appeal already exists for this submission.');
    const appeal = await client.query('INSERT INTO grade_appeals (organization_id, submission_id, learner_user_id, reason, evidence) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id, status, created_at', [session.organizationId, submissionId, session.userId, reason, JSON.stringify(Array.isArray(body.evidence) ? body.evidence.slice(0, 10) : [])]);
    await recordAudit(client, session, 'grade.appeal_opened', 'submission', submissionId);
    return appeal.rows[0];
  });
  send(response, 201, result);
}

async function listAppeals(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  const appeals = await inTenant(session, async (client) => {
    let sql = 'SELECT ga.id, ga.submission_id, ga.learner_user_id, ga.reason, ga.status, ga.resolution, ga.created_at FROM grade_appeals ga WHERE ga.organization_id = $1';
    const params: unknown[] = [session.organizationId];
    if (session.role === 'student') { sql += ' AND ga.learner_user_id = $2'; params.push(session.userId); }
    else if (session.role === 'lecturer') { sql += ' AND EXISTS (SELECT 1 FROM submissions s JOIN assignments a ON a.id = s.assignment_id AND a.organization_id = s.organization_id JOIN cohort_staff cs ON cs.cohort_id = a.cohort_id AND cs.organization_id = a.organization_id WHERE s.organization_id = ga.organization_id AND s.id = ga.submission_id AND cs.lecturer_user_id = $2)'; params.push(session.userId); }
    else if (!['institution_admin', 'platform_admin'].includes(session.role)) throw new HttpError(403, 'Role cannot view appeals.');
    sql += ' ORDER BY ga.created_at DESC LIMIT 250';
    return (await client.query(sql, params)).rows;
  });
  send(response, 200, { appeals });
}

async function resolveAppeal(request: IncomingMessage, response: ServerResponse, appealId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin', 'platform_admin']);
  requireUuid(appealId);
  const body = await readJson(request);
  const decision = body.decision;
  if (!['upheld', 'adjusted', 'rejected'].includes(String(decision))) throw new HttpError(400, 'Decision must be upheld, adjusted, or rejected.');
  const resolution = requireValue(body.resolution, 'appeal resolution', 10000);
  const result = await inTenant(session, async (client) => {
    const appeal = await client.query("SELECT ga.id, ga.submission_id, ga.status, s.assignment_id FROM grade_appeals ga JOIN submissions s ON s.id = ga.submission_id AND s.organization_id = ga.organization_id WHERE ga.organization_id = $1 AND ga.id = $2 AND ga.status IN ('open','under_review') FOR UPDATE", [session.organizationId, appealId]);
    if (!appeal.rowCount) throw new HttpError(404, 'Open appeal not found.');
    let newGrade: number | null = null;
    if (decision === 'adjusted') {
      newGrade = Number(body.grade);
      if (!Number.isFinite(newGrade) || newGrade < 0 || newGrade > 100) throw new HttpError(400, 'An adjusted grade between 0 and 100 is required.');
      const prior = await client.query('SELECT a.assessed_by, a.rubric_version FROM assessments a WHERE a.organization_id = $1 AND a.submission_id = $2 ORDER BY a.version DESC LIMIT 1', [session.organizationId, appeal.rows[0].submission_id]);
      if (!prior.rowCount || !prior.rows[0].assessed_by || prior.rows[0].assessed_by === session.userId) throw new HttpError(409, 'A distinct original assessor is required for an adjusted grade.');
      const version = await client.query('SELECT COALESCE(max(version), 0) + 1 AS version FROM assessments WHERE organization_id = $1 AND submission_id = $2', [session.organizationId, appeal.rows[0].submission_id]);
      const assessment = await client.query("INSERT INTO assessments (organization_id, submission_id, rubric_version, lecturer_feedback, score, moderation_status, assessed_by, moderated_by, version, assessed_at, moderated_at) VALUES ($1,$2,$3,$4,$5,'moderated',$6,$7,$8,now(),now()) RETURNING id", [session.organizationId, appeal.rows[0].submission_id, prior.rows[0].rubric_version, resolution, newGrade, prior.rows[0].assessed_by, session.userId, version.rows[0].version]);
      await client.query('INSERT INTO grade_history (organization_id, submission_id, assessment_id, grade, feedback, rubric_version, recorded_by) VALUES ($1,$2,$3,$4,$5,$6,$7)', [session.organizationId, appeal.rows[0].submission_id, assessment.rows[0].id, newGrade, resolution, prior.rows[0].rubric_version, session.userId]);
    }
    await client.query('UPDATE grade_appeals SET status = $1, resolution = $2, resolved_by = $3, resolved_at = now() WHERE organization_id = $4 AND id = $5', [decision, resolution, session.userId, session.organizationId, appealId]);
    await recordAudit(client, session, 'grade.appeal_' + String(decision), 'appeal', appealId);
    return { appealId, status: decision, adjustedGrade: newGrade };
  });
  send(response, 200, result);
}

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const text = /^[\\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + text.replace(/"/g, '""') + '"';
}
async function exportAcademicCsv(request: IncomingMessage, response: ServerResponse, kind: 'gradebook' | 'cohort_roster'): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer', 'institution_admin', 'platform_admin']);
  const csv = await inTenant(session, async (client) => {
    let rows: unknown[][];
    if (kind === 'gradebook') {
      const lecturerScope = session.role === 'lecturer' ? ' AND EXISTS (SELECT 1 FROM cohort_staff cs WHERE cs.organization_id = a.organization_id AND cs.cohort_id = a.cohort_id AND cs.lecturer_user_id = $2)' : '';
      const params = session.role === 'lecturer' ? [session.organizationId, session.userId] : [session.organizationId];
      const result = await client.query(
        'SELECT c.code, h.name AS cohort, a.title AS assignment, u.email AS learner_email, u.display_name AS learner, gh.grade, gh.feedback, gh.recorded_at FROM grade_history gh JOIN submissions s ON s.id = gh.submission_id AND s.organization_id = gh.organization_id JOIN assignments a ON a.id = s.assignment_id AND a.organization_id = s.organization_id JOIN cohorts h ON h.id = a.cohort_id AND h.organization_id = a.organization_id JOIN courses c ON c.id = h.course_id AND c.organization_id = h.organization_id JOIN users u ON u.id = s.student_user_id WHERE gh.organization_id = $1' + lecturerScope + ' ORDER BY c.code, h.name, u.email, a.title',
        params,
      );
      rows = [['course_code','cohort','assignment','learner_email','learner','grade','feedback','recorded_at'], ...result.rows.map((r) => [r.code,r.cohort,r.assignment,r.learner_email,r.learner,r.grade,r.feedback,r.recorded_at])];
    } else {
      const lecturerScope = session.role === 'lecturer' ? ' AND EXISTS (SELECT 1 FROM cohort_staff cs WHERE cs.organization_id = h.organization_id AND cs.cohort_id = h.id AND cs.lecturer_user_id = $2)' : '';
      const params = session.role === 'lecturer' ? [session.organizationId, session.userId] : [session.organizationId];
      const result = await client.query(
        'SELECT c.code, h.name AS cohort, u.email, u.display_name, e.status, e.enrolled_at FROM enrollments e JOIN cohorts h ON h.id = e.cohort_id AND h.organization_id = e.organization_id JOIN courses c ON c.id = h.course_id AND c.organization_id = h.organization_id JOIN users u ON u.id = e.student_user_id WHERE e.organization_id = $1' + lecturerScope + ' ORDER BY c.code, h.name, u.email',
        params,
      );
      rows = [['course_code','cohort','email','learner','enrollment_status','enrolled_at'], ...result.rows.map((r) => [r.code,r.cohort,r.email,r.display_name,r.status,r.enrolled_at])];
    }
    await recordAudit(client, session, 'academic_export.generated', kind, null);
    return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  });
  response.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="' + kind + '.csv"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(csv);
}

async function createResearchProject(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer', 'institution_admin', 'platform_admin']);
  const body = await readJson(request);
  const title = requireValue(body.title, 'research title', 180);
  const question = requireValue(body.researchQuestion, 'research question', 4000);
  const abstract = typeof body.abstract === 'string' ? body.abstract.slice(0, 10000) : '';
  const methodology = body.methodology && typeof body.methodology === 'object' && !Array.isArray(body.methodology) ? JSON.stringify(body.methodology) : '{}';
  if (methodology.length > 20000) throw new HttpError(400, 'Methodology specification is too large.');
  const ethics = 'pending';
  const project = await inTenant(session, async (client) => {
    const result = await client.query('INSERT INTO research_projects (organization_id, title, abstract, research_question, methodology, ethics_status, principal_investigator) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING id, status, ethics_status', [session.organizationId,title,abstract,question,methodology,ethics,session.userId]);
    await appendResearchProvenance(client, session, result.rows[0].id, 'project.created', { title, researchQuestion: question, methodology: JSON.parse(methodology) });
    await recordAudit(client, session, 'research.project_created', 'research_project', result.rows[0].id);
    return result.rows[0];
  });
  send(response, 201, project);
}

async function createResearchWorkspace(request: IncomingMessage, response: ServerResponse, projectId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer', 'institution_admin', 'platform_admin']);
  requireUuid(projectId);
  const body = await readJson(request);
  const spec = body.environmentSpec && typeof body.environmentSpec === 'object' && !Array.isArray(body.environmentSpec) ? JSON.stringify(body.environmentSpec) : '{}';
  const quotaObject = body.resourceQuota && typeof body.resourceQuota === 'object' && !Array.isArray(body.resourceQuota) ? body.resourceQuota as Record<string, unknown> : { cpuMillis: 1000, memoryMiB: 2048, diskMiB: 4096, maxDurationSeconds: 3600 };
  const quota = JSON.stringify(quotaObject);
  const cpu = Number(quotaObject.cpuMillis), memory = Number(quotaObject.memoryMiB), disk = Number(quotaObject.diskMiB), duration = Number(quotaObject.maxDurationSeconds);
  if (!Number.isInteger(cpu) || cpu < 100 || cpu > 8000 || !Number.isInteger(memory) || memory < 256 || memory > 16384 ||
      !Number.isInteger(disk) || disk < 512 || disk > 32768 || !Number.isInteger(duration) || duration < 60 || duration > 14400) {
    throw new HttpError(400, 'Workspace quotas exceed the institution research limits.');
  }
  if (spec.length > 10000 || quota.length > 2000) throw new HttpError(400, 'Workspace configuration is too large.');
  const workspace = await inTenant(session, async (client) => {
    const project = await client.query('SELECT id, ethics_status, principal_investigator FROM research_projects WHERE organization_id = $1 AND id = $2', [session.organizationId, projectId]);
    if (!project.rowCount) throw new HttpError(404, 'Research project not found.');
    if (project.rows[0].principal_investigator !== session.userId && !['institution_admin','platform_admin'].includes(session.role)) throw new HttpError(403, 'Only the principal investigator or institution administrator can create this workspace.');
    if (!['approved','not_required'].includes(project.rows[0].ethics_status)) throw new HttpError(409, 'Research ethics approval is required before provisioning a workspace.');
    const result = await client.query("INSERT INTO research_workspaces (organization_id, project_id, owner_user_id, environment_spec, resource_quota, state) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,'stopped') RETURNING id, state", [session.organizationId,projectId,session.userId,spec,quota]);
    await appendResearchProvenance(client, session, projectId, 'workspace.created', { workspaceId: result.rows[0].id, environmentSpec: JSON.parse(spec), resourceQuota: JSON.parse(quota) });
    await recordAudit(client, session, 'research.workspace_created', 'research_workspace', result.rows[0].id);
    return { ...result.rows[0], executionAvailable: false, message: 'Workspace metadata is provisioned; no compute worker is connected.' };
  });
  send(response, 201, workspace);
}

async function createResearchExperiment(request: IncomingMessage, response: ServerResponse, workspaceId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer', 'institution_admin', 'platform_admin']);
  requireUuid(workspaceId);
  const body = await readJson(request);
  const title = requireValue(body.title, 'experiment title', 180);
  const hypothesis = requireValue(body.hypothesis, 'experiment hypothesis', 4000);
  const protocol = body.protocol && typeof body.protocol === 'object' && !Array.isArray(body.protocol) ? JSON.stringify(body.protocol) : '{}';
  const revision = requireValue(body.codeRevision, 'source revision', 120);
  const digest = requireValue(body.environmentDigest, 'environment digest', 160);
  const lockDigest = requireValue(body.dependencyLockDigest, 'dependency lockfile digest', 80);
  if (!/^[a-f0-9]{40}$/i.test(revision) || !/^(sha256:)?[a-f0-9]{64}$/i.test(digest) || !/^sha256:[a-f0-9]{64}$/i.test(lockDigest) || protocol.length > 20000) throw new HttpError(400, 'Provide a source commit and immutable environment digest.');
  const seed = Number(body.randomSeed);
  if (!Number.isSafeInteger(seed) || seed < 0) throw new HttpError(400, 'A non-negative reproducibility seed is required.');
  const result = await inTenant(session, async (client) => {
    const workspace = await client.query('SELECT w.id, w.project_id, w.state, w.owner_user_id, p.ethics_status FROM research_workspaces w JOIN research_projects p ON p.id = w.project_id AND p.organization_id = w.organization_id WHERE w.organization_id = $1 AND w.id = $2', [session.organizationId,workspaceId]);
    if (!workspace.rowCount) throw new HttpError(404, 'Research workspace not found.');
    if (workspace.rows[0].owner_user_id !== session.userId && !['institution_admin','platform_admin'].includes(session.role)) throw new HttpError(403, 'Only the workspace owner or institution administrator can register experiments.');
    if (!['approved','not_required'].includes(workspace.rows[0].ethics_status)) throw new HttpError(409, 'Research ethics approval is required.');
    const experiment = await client.query("INSERT INTO research_experiments (organization_id, workspace_id, created_by, title, hypothesis, protocol, code_revision, environment_digest, dependency_lock_digest, random_seed, status) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,'queued') RETURNING id, status", [session.organizationId,workspaceId,session.userId,title,hypothesis,protocol,revision,digest,lockDigest,seed]);
    await appendResearchProvenance(client, session, workspace.rows[0].project_id, 'experiment.registered', { experimentId: experiment.rows[0].id, title, hypothesis, protocol: JSON.parse(protocol), codeRevision: revision, environmentDigest: digest, dependencyLockDigest: lockDigest, randomSeed: seed }, experiment.rows[0].id);
    await recordAudit(client, session, 'research.experiment_registered', 'research_experiment', experiment.rows[0].id);
    return { ...experiment.rows[0], executionAvailable: false, message: 'Experiment provenance is registered; no execution worker is connected.' };
  });
  send(response, 201, result);
}


async function reviewResearchEthics(request: IncomingMessage, response: ServerResponse, projectId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin', 'platform_admin']);
  requireUuid(projectId);
  const body = await readJson(request);
  const decision = body.decision;
  if (!['approved','rejected','not_required'].includes(String(decision))) throw new HttpError(400, 'Invalid ethics decision.');
  const reference = requireValue(body.reference, 'ethics review reference', 240);
  const rationale = requireValue(body.rationale, 'ethics review rationale', 4000);
  if (rationale.length < 30) throw new HttpError(400, 'Provide at least 30 characters explaining the ethics decision.');
  const result = await inTenant(session, async (client) => {
    const project = await client.query("UPDATE research_projects SET ethics_status = $1, ethics_reference = $2, ethics_reviewed_by = $3, ethics_reviewed_at = now() WHERE organization_id = $4 AND id = $5 AND ethics_status = 'pending' RETURNING id", [decision,reference,session.userId,session.organizationId,projectId]);
    if (!project.rowCount) throw new HttpError(404, 'Pending research project not found.');
    await appendResearchProvenance(client, session, projectId, 'ethics.reviewed', { decision, reference, rationale });
    await recordAudit(client, session, 'research.ethics_' + String(decision), 'research_project', projectId);
    return { projectId, ethicsStatus: decision };
  });
  send(response, 200, result);
}


async function getResearchProvenance(request: IncomingMessage, response: ServerResponse, projectId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['lecturer','institution_admin','platform_admin']);
  requireUuid(projectId);
  const result = await inTenant(session, async (client) => {
    const project = await client.query('SELECT principal_investigator FROM research_projects WHERE organization_id = $1 AND id = $2', [session.organizationId,projectId]);
    if (!project.rowCount) throw new HttpError(404, 'Research project not found.');
    if (project.rows[0].principal_investigator !== session.userId && !['institution_admin','platform_admin'].includes(session.role)) throw new HttpError(403, 'Only the principal investigator or institution administrator can inspect provenance.');
    const events = await client.query('SELECT rp.sequence_no, rp.actor_user_id, u.display_name AS actor, rp.event_type, rp.payload, rp.previous_hash, rp.event_hash, rp.occurred_at FROM research_provenance rp JOIN users u ON u.id = rp.actor_user_id WHERE rp.organization_id = $1 AND rp.project_id = $2 ORDER BY rp.sequence_no', [session.organizationId,projectId]);
    let previousHash: string | null = null;
    let expectedSequence = 1;
    for (const event of events.rows) {
      const occurredAt = new Date(event.occurred_at).toISOString();
      const payloadJson = canonicalJson(event.payload);
      const computed = createHash('sha256').update([previousHash ?? '',projectId,String(expectedSequence),event.actor_user_id,event.event_type,payloadJson,occurredAt].join('|')).digest('hex');
      if (Number(event.sequence_no) !== expectedSequence || event.previous_hash !== previousHash || event.event_hash.trim() !== computed) {
        throw new HttpError(409, 'Research provenance chain verification failed.');
      }
      previousHash = event.event_hash.trim();
      expectedSequence += 1;
    }
    return { projectId, verified: true, eventCount: events.rowCount, headHash: previousHash, events: events.rows };
  });
  send(response,200,result);
}

async function createLabDefinition(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin','platform_admin']);
  const body = await readJson(request);
  const slug = requireValue(body.slug, 'lab slug', 80).toLowerCase();
  const title = requireValue(body.title, 'lab title', 180);
  const description = typeof body.description === 'string' ? body.description.slice(0, 4000) : '';
  const digest = requireValue(body.imageDigest, 'immutable image digest', 80);
  const mode = body.targetMode;
  const policy = body.policy && typeof body.policy === 'object' && !Array.isArray(body.policy) ? JSON.stringify(body.policy) : '{}';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^sha256:[a-f0-9]{64}$/.test(digest) || !['guided','isolated_kali','research'].includes(String(mode)) || policy.length > 10000) throw new HttpError(400, 'Invalid lab definition.');
  const parsed = JSON.parse(policy) as Record<string, unknown>;
  const egress = parsed.egress as Record<string, unknown> | undefined;
  if (!egress || egress.default !== 'deny' || (Array.isArray(egress.allow) && egress.allow.length > 0) || parsed.hostMounts !== false || parsed.privileged !== false || parsed.hostNetwork !== false || parsed.runtimeSocket !== false || parsed.cloudMetadata !== false) throw new HttpError(400, 'Lab policy must explicitly deny egress, host mounts, host networking, runtime sockets, metadata access and privileged execution.');
  const result = await inTenant(session, async (client) => {
    const lab = await client.query("INSERT INTO lab_definitions (organization_id, slug, title, description, image_digest, target_mode, policy, version, status) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,1,'draft') RETURNING id, status", [session.organizationId,slug,title,description,digest,mode,policy]);
    await recordAudit(client, session, 'lab_definition.created', 'lab_definition', lab.rows[0].id);
    return lab.rows[0];
  });
  send(response, 201, result);
}

async function approveLabDefinition(request: IncomingMessage, response: ServerResponse, labId: string): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['institution_admin','platform_admin']);
  requireUuid(labId);
  const result = await inTenant(session, async (client) => {
    const lab = await client.query("UPDATE lab_definitions SET status = 'approved', approved_by = $1, approved_at = now() WHERE organization_id = $2 AND id = $3 AND status = 'draft' RETURNING id, status", [session.userId,session.organizationId,labId]);
    if (!lab.rowCount) throw new HttpError(404, 'Draft lab definition not found.');
    await recordAudit(client, session, 'lab_definition.approved', 'lab_definition', labId);
    return lab.rows[0];
  });
  send(response, 200, result);
}

async function requestLabSession(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  requireRole(session, ['student', 'lecturer']);
  // Deliberately fail closed until an independently deployed, security-tested VM orchestrator exists.
  if (process.env.LAB_ORCHESTRATOR_ENABLED !== 'true' || !process.env.LAB_ORCHESTRATOR_URL) {
    throw new HttpError(503, 'Live Kali infrastructure is not configured. No VM or network namespace was created.');
  }
  throw new HttpError(503, 'The configured provider has not passed the worker attestation and network-isolation gate. Live sessions remain disabled.');
}

export function createApiServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const origin = request.headers.origin;
      const allowedOrigin = process.env.APP_ORIGIN;
      if (origin && allowedOrigin && origin !== allowedOrigin) throw new HttpError(403, 'Cross-origin request rejected.');
      if (request.method === 'OPTIONS') {
        response.writeHead(204, { 'cache-control': 'no-store' }); response.end(); return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        await pool.query('SELECT 1'); send(response, 200, { status: 'ok', service: 'cybersandbox-api' }); return;
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/login') return await login(request, response);
      if (request.method === 'GET' && url.pathname === '/api/auth/session') return await currentSession(request, response);
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') return await logout(request, response);


      if (request.method === 'GET' && url.pathname === '/api/admin/courses') return await listAdminCourses(request,response);
      const adminModulesMatch = url.pathname.match(/^\/api\/admin\/courses\/([^/]+)\/modules$/);
      if (request.method === 'GET' && adminModulesMatch) return await listCourseModules(request,response,decodeURIComponent(adminModulesMatch[1]));
      const activateCohortMatch = url.pathname.match(/^\/api\/cohorts\/([^/]+)\/activate$/);
      if (request.method === 'POST' && activateCohortMatch) return await activateCohort(request,response,decodeURIComponent(activateCohortMatch[1]));
      if (request.method === 'POST' && url.pathname === '/api/courses') return await createCourse(request, response);
      const publishCourseMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/publish$/);
      if (request.method === 'POST' && publishCourseMatch) return await publishCourse(request, response, decodeURIComponent(publishCourseMatch[1]));

      const modulesMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/modules$/);
      if (request.method === 'POST' && modulesMatch) return await createCourseModule(request, response, decodeURIComponent(modulesMatch[1]));
      const lessonCreateMatch = url.pathname.match(/^\/api\/modules\/([^/]+)\/lessons$/);
      if (request.method === 'POST' && lessonCreateMatch) return await createModuleLesson(request, response, decodeURIComponent(lessonCreateMatch[1]));
      const prerequisiteMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)\/prerequisites$/);
      if (request.method === 'POST' && prerequisiteMatch) return await addLessonPrerequisite(request, response, decodeURIComponent(prerequisiteMatch[1]));
      if (request.method === 'POST' && url.pathname === '/api/cohorts') return await createCohort(request, response);
      const staffMatch = url.pathname.match(/^\/api\/cohorts\/([^/]+)\/staff$/);
      if (request.method === 'POST' && staffMatch) return await assignLecturer(request, response, decodeURIComponent(staffMatch[1]));
      const publishAssignmentMatch = url.pathname.match(/^\/api\/assignments\/([^/]+)\/publish$/);
      if (request.method === 'POST' && publishAssignmentMatch) return await publishAssignment(request, response, decodeURIComponent(publishAssignmentMatch[1]));
      const completeLessonMatch = url.pathname.match(/^\/api\/lessons\/([^/]+)\/complete$/);
      if (request.method === 'POST' && completeLessonMatch) return await completeLesson(request, response, decodeURIComponent(completeLessonMatch[1]));
      const appealMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/appeals$/);
      if (request.method === 'POST' && appealMatch) return await createAppeal(request, response, decodeURIComponent(appealMatch[1]));
      if (request.method === 'GET' && url.pathname === '/api/appeals') return await listAppeals(request, response);
      const resolveAppealMatch = url.pathname.match(/^\/api\/appeals\/([^/]+)\/resolve$/);
      if (request.method === 'POST' && resolveAppealMatch) return await resolveAppeal(request, response, decodeURIComponent(resolveAppealMatch[1]));
      if (request.method === 'GET' && url.pathname === '/api/exports/gradebook.csv') return await exportAcademicCsv(request, response, 'gradebook');
      if (request.method === 'GET' && url.pathname === '/api/exports/cohort-roster.csv') return await exportAcademicCsv(request, response, 'cohort_roster');
      if (request.method === 'POST' && url.pathname === '/api/research/projects') return await createResearchProject(request, response);
      const researchWorkspaceMatch = url.pathname.match(/^\/api\/research\/projects\/([^/]+)\/workspaces$/);
      if (request.method === 'POST' && researchWorkspaceMatch) return await createResearchWorkspace(request, response, decodeURIComponent(researchWorkspaceMatch[1]));
      const experimentMatch = url.pathname.match(/^\/api\/research\/workspaces\/([^/]+)\/experiments$/);
      if (request.method === 'POST' && experimentMatch) return await createResearchExperiment(request, response, decodeURIComponent(experimentMatch[1]));

      const provenanceMatch = url.pathname.match(/^\/api\/research\/projects\/([^/]+)\/provenance$/);
      if (request.method === 'GET' && provenanceMatch) return await getResearchProvenance(request,response,decodeURIComponent(provenanceMatch[1]));
      const ethicsReviewMatch = url.pathname.match(/^\/api\/research\/projects\/([^/]+)\/ethics-review$/);
      if (request.method === 'POST' && ethicsReviewMatch) return await reviewResearchEthics(request, response, decodeURIComponent(ethicsReviewMatch[1]));
      if (request.method === 'POST' && url.pathname === '/api/labs/definitions') return await createLabDefinition(request, response);
      const approveLabMatch = url.pathname.match(/^\/api\/labs\/definitions\/([^/]+)\/approve$/);
      if (request.method === 'POST' && approveLabMatch) return await approveLabDefinition(request, response, decodeURIComponent(approveLabMatch[1]));
      if (request.method === 'POST' && url.pathname === '/api/labs/sessions') return await requestLabSession(request, response);
      if (request.method === 'GET' && url.pathname === '/api/dashboard') return await dashboard(request, response);
      if (request.method === 'GET' && url.pathname === '/api/courses') return await listCourses(request, response);
      if (request.method === 'POST' && url.pathname === '/api/enrolments') return await enrol(request, response);

      if (request.method === 'GET' && url.pathname === '/api/cohorts') return await listCohorts(request, response);
      if (request.method === 'GET' && url.pathname === '/api/submissions') return await listSubmissions(request, response);
      if (request.method === 'GET' && url.pathname === '/api/assessments/pending') return await listPendingAssessments(request, response);
      const gradeHistoryMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/grades$/);
      if (request.method === 'GET' && gradeHistoryMatch) return await listGradeHistory(request, response, decodeURIComponent(gradeHistoryMatch[1]));
      if (request.method === 'GET' && url.pathname === '/api/assignments') return await listAssignments(request, response);
      if (request.method === 'POST' && url.pathname === '/api/assignments') return await createAssignment(request, response);
      const pathwayMatch = url.pathname.match(/^\/api\/courses\/([^/]+)\/pathway$/);
      if (request.method === 'GET' && pathwayMatch) return await pathway(request, response, decodeURIComponent(pathwayMatch[1]));
      const submissionMatch = url.pathname.match(/^\/api\/assignments\/([^/]+)\/submissions$/);
      if (request.method === 'POST' && submissionMatch) return await submitAssignment(request, response, decodeURIComponent(submissionMatch[1]));
      const assessmentMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/assessments$/);
      if (request.method === 'POST' && assessmentMatch) return await assessSubmission(request, response, decodeURIComponent(assessmentMatch[1]));
      const moderationMatch = url.pathname.match(/^\/api\/assessments\/([^/]+)\/moderate$/);
      if (request.method === 'POST' && moderationMatch) return await moderateAssessment(request, response, decodeURIComponent(moderationMatch[1]));
      throw new HttpError(404, 'Route not found.');
    } catch (error) {
      const status = error instanceof HttpError ? error.statusCode : 500;
      if (status >= 500) console.error('API request failed', error);
      send(response, status, { error: status >= 500 ? 'An internal error occurred.' : error instanceof Error ? error.message : 'Invalid request.' });
    }
  });
}
