CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 2 AND 160),
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('student', 'lecturer', 'institution_admin', 'platform_admin', 'lab_operator')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id),
  UNIQUE (user_id, organization_id, id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash char(64) NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  FOREIGN KEY (user_id, organization_id) REFERENCES memberships(user_id, organization_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  attempt_key char(64) PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  window_started timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  level text NOT NULL CHECK (level IN ('undergraduate', 'postgraduate', 'professional')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  course_id uuid NOT NULL,
  name text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'archived')),
  FOREIGN KEY (organization_id, course_id) REFERENCES courses(organization_id, id) ON DELETE CASCADE,
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL,
  student_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'withdrawn')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, cohort_id) REFERENCES cohorts(organization_id, id) ON DELETE CASCADE,
  UNIQUE (organization_id, cohort_id, student_user_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  cohort_id uuid NOT NULL,
  title text NOT NULL,
  instructions text NOT NULL,
  rubric jsonb NOT NULL,
  rubric_version integer NOT NULL DEFAULT 1 CHECK (rubric_version > 0),
  due_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, cohort_id) REFERENCES cohorts(organization_id, id) ON DELETE CASCADE,
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL,
  student_user_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (length(body) <= 100000),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'returned', 'graded', 'resubmitted')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, assignment_id) REFERENCES assignments(organization_id, id) ON DELETE CASCADE,
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  rubric_version integer NOT NULL,
  machine_feedback jsonb,
  lecturer_feedback text,
  score numeric(6,2),
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'moderated', 'returned', 'disputed')),
  assessed_by uuid REFERENCES users(id),
  moderated_by uuid REFERENCES users(id),
  assessed_at timestamptz,
  moderated_at timestamptz,
  FOREIGN KEY (organization_id, submission_id) REFERENCES submissions(organization_id, id) ON DELETE CASCADE,
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  correlation_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

-- Tenant tables are protected even if an application query accidentally omits its tenant filter.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['courses','cohorts','enrollments','assignments','submissions','assessments','audit_events']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY institution_isolation ON %I USING (organization_id::text = current_setting(''app.current_organization_id'', true)) WITH CHECK (organization_id::text = current_setting(''app.current_organization_id'', true))',
      table_name
    );
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS memberships_org_role_idx ON memberships (organization_id, role, status);
CREATE INDEX IF NOT EXISTS cohorts_org_course_idx ON cohorts (organization_id, course_id);
CREATE INDEX IF NOT EXISTS enrollments_student_idx ON enrollments (organization_id, student_user_id);
CREATE INDEX IF NOT EXISTS assignments_cohort_due_idx ON assignments (organization_id, cohort_id, due_at);
CREATE INDEX IF NOT EXISTS submissions_assignment_student_idx ON submissions (organization_id, assignment_id, student_user_id);
CREATE INDEX IF NOT EXISTS audit_events_org_time_idx ON audit_events (organization_id, occurred_at DESC);
