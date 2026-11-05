import { createHash } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { pool, withInstitution } from './database.js';
import { createSessionToken, hashSessionToken, parseCookies, verifyPassword } from './security.js';

const SESSION_COOKIE = 'cybersandbox_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const MAX_BODY_BYTES = 16 * 1024;
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
  return inTenant(session, async (client) => {
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
  const data = await withInstitution(session.organizationId, async (client) => {
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
  const courses = await withInstitution(session.organizationId, async (client) => {
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
  const result = await withInstitution(session.organizationId, async (client) => {
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
  const result = await withInstitution(session.organizationId, async (client) => {
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

async function listAssignments(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const session = await requireSession(request);
  const assignments = await withInstitution(session.organizationId, async (client) => {
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
  const rubric = JSON.stringify(body.rubric);
  if (rubric.length > 20000) throw new HttpError(400, 'Rubric is too large.');
  const dueAt = body.dueAt === undefined || body.dueAt === null ? null : new Date(requireValue(body.dueAt, 'due date', 64));
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new HttpError(400, 'Invalid due date.');
  const created = await withInstitution(session.organizationId, async (client) => {
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
  const created = await withInstitution(session.organizationId, async (client) => {
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
  const assessment = await withInstitution(session.organizationId, async (client) => {
    const source = await client.query(
      'SELECT s.id, a.cohort_id, a.rubric_version FROM submissions s JOIN assignments a ON a.id = s.assignment_id AND a.organization_id = s.organization_id WHERE s.organization_id = $1 AND s.id = $2',
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
  const result = await withInstitution(session.organizationId, async (client) => {
    const source = await client.query(
      'SELECT a.id, a.assessed_by, s.id AS submission_id, ass.cohort_id FROM assessments a JOIN submissions s ON s.id = a.submission_id AND s.organization_id = a.organization_id JOIN assignments ass ON ass.id = s.assignment_id AND ass.organization_id = s.organization_id WHERE a.organization_id = $1 AND a.id = $2 AND a.moderation_status = $3',
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
    await recordAudit(client, session, 'assessment.' + String(decision), 'assessment', assessmentId);
    return { assessmentId, moderationStatus: state };
  });
  send(response, 200, result);
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
      if (request.method === 'GET' && url.pathname === '/api/dashboard') return await dashboard(request, response);
      if (request.method === 'GET' && url.pathname === '/api/courses') return await listCourses(request, response);
      if (request.method === 'POST' && url.pathname === '/api/enrolments') return await enrol(request, response);
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
