-- Academic governance, laboratory control-plane records, and research provenance.
CREATE TABLE IF NOT EXISTS course_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('student','lecturer','institution_admin')),
  token_hash char(64) NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invited_by, organization_id) REFERENCES memberships(user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS grade_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  assessment_id uuid NOT NULL,
  grade numeric(6,2) NOT NULL CHECK (grade BETWEEN 0 AND 100),
  feedback text NOT NULL,
  rubric_version integer NOT NULL CHECK (rubric_version > 0),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, submission_id) REFERENCES submissions(organization_id, id),
  FOREIGN KEY (organization_id, assessment_id) REFERENCES assessments(organization_id, id),
  FOREIGN KEY (recorded_by, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS grade_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  learner_user_id uuid NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 20 AND 10000),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_review','upheld','adjusted','rejected','withdrawn')),
  assigned_reviewer uuid,
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, submission_id) REFERENCES submissions(organization_id, id),
  FOREIGN KEY (learner_user_id, organization_id) REFERENCES memberships(user_id, organization_id),
  FOREIGN KEY (assigned_reviewer, organization_id) REFERENCES memberships(user_id, organization_id),
  FOREIGN KEY (resolved_by, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS academic_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  export_type text NOT NULL CHECK (export_type IN ('gradebook','cohort_roster','course_progress','audit_report','appeals_register')),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','ready','failed','expired')),
  artifact_key text,
  sha256 char(64),
  row_count integer,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (requested_by, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS lab_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_digest text NOT NULL CHECK (image_digest ~ '^sha256:[a-f0-9]{64}$'),
  target_mode text NOT NULL CHECK (target_mode IN ('guided','isolated_kali','research')),
  policy jsonb NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','retired')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (approved_by, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, slug, version)
);

CREATE TABLE IF NOT EXISTS lab_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lab_definition_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'unconfigured' CHECK (provider IN ('unconfigured','firecracker','kubevirt','dedicated_vm')),
  provider_reference text,
  state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','authorized','provisioning','ready','active','stopping','destroying','destroyed','failed','expired')),
  cpu_millis integer NOT NULL CHECK (cpu_millis BETWEEN 100 AND 8000),
  memory_mib integer NOT NULL CHECK (memory_mib BETWEEN 256 AND 16384),
  disk_mib integer NOT NULL CHECK (disk_mib BETWEEN 512 AND 32768),
  max_duration_seconds integer NOT NULL CHECK (max_duration_seconds BETWEEN 60 AND 14400),
  egress_policy jsonb NOT NULL DEFAULT '{"default":"deny"}'::jsonb,
  started_at timestamptz,
  expires_at timestamptz NOT NULL,
  destroyed_at timestamptz,
  teardown_verified boolean NOT NULL DEFAULT false,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, lab_definition_id) REFERENCES lab_definitions(organization_id, id),
  FOREIGN KEY (owner_user_id, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id),
  CHECK (provider_reference IS NULL OR length(provider_reference) <= 256),
  CHECK (state <> 'destroyed' OR (destroyed_at IS NOT NULL AND teardown_verified = true))
);

CREATE TABLE IF NOT EXISTS lab_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lab_session_id uuid NOT NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, lab_session_id) REFERENCES lab_sessions(organization_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS research_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  abstract text NOT NULL DEFAULT '',
  research_question text NOT NULL,
  methodology jsonb NOT NULL,
  ethics_status text NOT NULL DEFAULT 'pending' CHECK (ethics_status IN ('pending','approved','rejected','not_required')),
  ethics_reference text,
  ethics_reviewed_by uuid,
  ethics_reviewed_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','archived')),
  principal_investigator uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (principal_investigator, organization_id) REFERENCES memberships(user_id, organization_id),
  FOREIGN KEY (ethics_reviewed_by, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS research_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  environment_spec jsonb NOT NULL,
  state text NOT NULL DEFAULT 'stopped' CHECK (state IN ('stopped','provisioning','ready','running','stopping','failed')),
  resource_quota jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, project_id) REFERENCES research_projects(organization_id, id),
  FOREIGN KEY (owner_user_id, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS research_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  hypothesis text NOT NULL,
  protocol jsonb NOT NULL,
  code_revision text NOT NULL,
  environment_digest text NOT NULL,
  random_seed bigint NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  result_manifest jsonb,
  FOREIGN KEY (organization_id, workspace_id) REFERENCES research_workspaces(organization_id, id),
  FOREIGN KEY (created_by, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS research_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  title text NOT NULL,
  artifact_key text NOT NULL,
  sha256 char(64) NOT NULL,
  media_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size BETWEEN 1 AND 10737418240),
  license text NOT NULL,
  consent_basis text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, project_id) REFERENCES research_projects(organization_id, id),
  FOREIGN KEY (uploaded_by, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id)
);

CREATE TABLE IF NOT EXISTS research_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  experiment_id uuid,
  dataset_id uuid,
  actor_user_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  sequence_no bigint NOT NULL CHECK (sequence_no > 0),
  previous_hash char(64),
  event_hash char(64) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, project_id) REFERENCES research_projects(organization_id, id),
  FOREIGN KEY (organization_id, experiment_id) REFERENCES research_experiments(organization_id, id),
  FOREIGN KEY (organization_id, dataset_id) REFERENCES research_datasets(organization_id, id),
  FOREIGN KEY (actor_user_id, organization_id) REFERENCES memberships(user_id, organization_id),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, project_id, sequence_no)
);

CREATE OR REPLACE FUNCTION reject_immutable_record_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'This record is append-only and cannot be changed or deleted';
END $$;

DROP TRIGGER IF EXISTS grade_history_immutable ON grade_history;
CREATE TRIGGER grade_history_immutable BEFORE UPDATE OR DELETE ON grade_history
FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();

DROP TRIGGER IF EXISTS research_provenance_immutable ON research_provenance;
CREATE TRIGGER research_provenance_immutable BEFORE UPDATE OR DELETE ON research_provenance
FOR EACH ROW EXECUTE FUNCTION reject_immutable_record_mutation();


CREATE OR REPLACE FUNCTION reject_published_curriculum_mutation() RETURNS trigger LANGUAGE plpgsql AS $
DECLARE version_id uuid;
DECLARE published timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'course_versions' THEN
    IF TG_OP <> 'INSERT' AND OLD.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Published course versions are immutable';
    END IF;
    IF TG_OP = 'INSERT' AND NEW.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'Course versions must be published through the application workflow';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'learning_modules' THEN
    version_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.course_version_id ELSE NEW.course_version_id END;
  ELSIF TG_TABLE_NAME = 'learning_lessons' THEN
    SELECT course_version_id INTO version_id FROM learning_modules
    WHERE organization_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END
      AND id = CASE WHEN TG_OP = 'DELETE' THEN OLD.module_id ELSE NEW.module_id END;
  ELSIF TG_TABLE_NAME = 'lesson_prerequisites' THEN
    SELECT m.course_version_id INTO version_id
    FROM learning_lessons l JOIN learning_modules m ON m.id = l.module_id AND m.organization_id = l.organization_id
    WHERE l.organization_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END
      AND l.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.lesson_id ELSE NEW.lesson_id END;
  END IF;
  SELECT published_at INTO published FROM course_versions WHERE id = version_id;
  IF published IS NOT NULL THEN RAISE EXCEPTION 'Published learning pathways are immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $;

DROP TRIGGER IF EXISTS course_versions_immutable ON course_versions;
CREATE TRIGGER course_versions_immutable BEFORE INSERT OR UPDATE OR DELETE ON course_versions
FOR EACH ROW EXECUTE FUNCTION reject_published_curriculum_mutation();
DROP TRIGGER IF EXISTS learning_modules_immutable ON learning_modules;
CREATE TRIGGER learning_modules_immutable BEFORE INSERT OR UPDATE OR DELETE ON learning_modules
FOR EACH ROW EXECUTE FUNCTION reject_published_curriculum_mutation();
DROP TRIGGER IF EXISTS learning_lessons_immutable ON learning_lessons;
CREATE TRIGGER learning_lessons_immutable BEFORE INSERT OR UPDATE OR DELETE ON learning_lessons
FOR EACH ROW EXECUTE FUNCTION reject_published_curriculum_mutation();
DROP TRIGGER IF EXISTS lesson_prerequisites_immutable ON lesson_prerequisites;
CREATE TRIGGER lesson_prerequisites_immutable BEFORE INSERT OR UPDATE OR DELETE ON lesson_prerequisites
FOR EACH ROW EXECUTE FUNCTION reject_published_curriculum_mutation();


CREATE OR REPLACE FUNCTION enforce_academic_membership_role() RETURNS trigger LANGUAGE plpgsql AS $
DECLARE target_user uuid;
DECLARE target_role text;
DECLARE allowed_roles text[];
DECLARE member_status text;
BEGIN
  target_user := NULL;
  allowed_roles := ARRAY[]::text[];
  IF TG_TABLE_NAME = 'course_versions' THEN target_user := NEW.created_by; allowed_roles := ARRAY['institution_admin','platform_admin'];
  ELSIF TG_TABLE_NAME = 'cohort_staff' THEN target_user := NEW.lecturer_user_id; allowed_roles := ARRAY['lecturer'];
  ELSIF TG_TABLE_NAME = 'enrollments' THEN target_user := NEW.student_user_id; allowed_roles := ARRAY['student'];
  ELSIF TG_TABLE_NAME = 'lesson_completions' THEN target_user := NEW.learner_user_id; allowed_roles := ARRAY['student'];
  ELSIF TG_TABLE_NAME = 'assignments' THEN target_user := NEW.created_by; allowed_roles := ARRAY['lecturer','institution_admin','platform_admin'];
  ELSIF TG_TABLE_NAME = 'submissions' THEN target_user := NEW.student_user_id; allowed_roles := ARRAY['student'];
  ELSIF TG_TABLE_NAME = 'grade_appeals' THEN target_user := NEW.learner_user_id; allowed_roles := ARRAY['student'];
  ELSIF TG_TABLE_NAME = 'academic_exports' THEN target_user := NEW.requested_by; allowed_roles := ARRAY['lecturer','institution_admin','platform_admin'];
  ELSIF TG_TABLE_NAME = 'research_projects' THEN target_user := NEW.principal_investigator; allowed_roles := ARRAY['lecturer','institution_admin','platform_admin'];
  ELSIF TG_TABLE_NAME = 'research_workspaces' THEN target_user := NEW.owner_user_id; allowed_roles := ARRAY['lecturer','institution_admin','platform_admin'];
  ELSIF TG_TABLE_NAME = 'research_experiments' THEN target_user := NEW.created_by; allowed_roles := ARRAY['lecturer','institution_admin','platform_admin'];
  ELSIF TG_TABLE_NAME = 'research_datasets' THEN target_user := NEW.uploaded_by; allowed_roles := ARRAY['lecturer','institution_admin','platform_admin'];
  ELSIF TG_TABLE_NAME = 'course_invitations' THEN target_user := NEW.invited_by; allowed_roles := ARRAY['institution_admin','platform_admin'];
  ELSIF TG_TABLE_NAME = 'lab_definitions' THEN
    target_user := NEW.approved_by;
    allowed_roles := ARRAY['institution_admin','platform_admin'];
  ELSIF TG_TABLE_NAME = 'lab_sessions' THEN target_user := NEW.owner_user_id; allowed_roles := ARRAY['student','lecturer'];
  ELSIF TG_TABLE_NAME = 'assessments' THEN
    IF NEW.assessed_by IS NOT NULL THEN
      SELECT role,status INTO target_role,member_status FROM memberships WHERE user_id = NEW.assessed_by AND organization_id = NEW.organization_id;
      IF NOT FOUND OR member_status <> 'active' OR target_role NOT IN ('lecturer','institution_admin','platform_admin') THEN
        RAISE EXCEPTION 'Assessment actor must be an active lecturer or administrator in this institution';
      END IF;
    END IF;
    IF NEW.moderated_by IS NOT NULL THEN
      SELECT role,status INTO target_role,member_status FROM memberships WHERE user_id = NEW.moderated_by AND organization_id = NEW.organization_id;
      IF NOT FOUND OR member_status <> 'active' OR target_role NOT IN ('lecturer','institution_admin','platform_admin') THEN
        RAISE EXCEPTION 'Assessment moderator must be an active lecturer or administrator in this institution';
      END IF;
    END IF;
    RETURN NEW;
  ELSE
    RETURN NEW;
  END IF;
  IF target_user IS NULL THEN RETURN NEW; END IF;
  SELECT role,status INTO target_role,member_status FROM memberships WHERE user_id = target_user AND organization_id = NEW.organization_id;
  IF NOT FOUND OR member_status <> 'active' OR target_role <> ALL(allowed_roles) THEN
    RAISE EXCEPTION 'Actor does not have the required active institution membership role for %', TG_TABLE_NAME;
  END IF;
  IF TG_TABLE_NAME = 'submissions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM assignments a JOIN enrollments e
        ON e.organization_id = a.organization_id AND e.cohort_id = a.cohort_id
      WHERE a.organization_id = NEW.organization_id AND a.id = NEW.assignment_id
        AND a.status = 'published' AND e.student_user_id = NEW.student_user_id AND e.status = 'active'
    ) THEN RAISE EXCEPTION 'Submission requires an active enrolment in the published assignment cohort'; END IF;
  END IF;
  RETURN NEW;
END $;

CREATE OR REPLACE FUNCTION verify_research_provenance_link() RETURNS trigger LANGUAGE plpgsql AS $
DECLARE expected_previous char(64);
BEGIN
  SELECT event_hash INTO expected_previous FROM research_provenance
  WHERE organization_id = NEW.organization_id AND project_id = NEW.project_id
  ORDER BY sequence_no DESC LIMIT 1;
  IF NEW.previous_hash IS DISTINCT FROM expected_previous OR NEW.sequence_no <> COALESCE((SELECT max(sequence_no) + 1 FROM research_provenance WHERE organization_id = NEW.organization_id AND project_id = NEW.project_id), 1) THEN
    RAISE EXCEPTION 'Research provenance chain sequence or previous hash is invalid';
  END IF;
  RETURN NEW;
END $;
DROP TRIGGER IF EXISTS research_provenance_chain ON research_provenance;
CREATE TRIGGER research_provenance_chain BEFORE INSERT ON research_provenance
FOR EACH ROW EXECUTE FUNCTION verify_research_provenance_link();


DO $
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'course_versions','cohort_staff','enrollments','lesson_completions','assignments',
    'submissions','grade_appeals','academic_exports','research_projects','research_workspaces',
    'research_experiments','research_datasets','course_invitations','lab_definitions',
    'lab_sessions','assessments'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS academic_membership_role ON %I', table_name);
    EXECUTE format('CREATE TRIGGER academic_membership_role BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION enforce_academic_membership_role()', table_name);
  END LOOP;
END $;

CREATE OR REPLACE FUNCTION require_moderated_grade() RETURNS trigger LANGUAGE plpgsql AS $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.organization_id = NEW.organization_id AND a.id = NEW.assessment_id
      AND a.submission_id = NEW.submission_id AND a.moderation_status = 'moderated'
      AND a.score = NEW.grade
  ) THEN RAISE EXCEPTION 'Grade history requires a matching moderated assessment'; END IF;
  RETURN NEW;
END $;
DROP TRIGGER IF EXISTS grade_history_moderated_only ON grade_history;
CREATE TRIGGER grade_history_moderated_only BEFORE INSERT ON grade_history
FOR EACH ROW EXECUTE FUNCTION require_moderated_grade();

DO $
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'course_invitations','grade_history','grade_appeals','academic_exports',
    'lab_definitions','lab_sessions','lab_session_events','research_projects',
    'research_workspaces','research_experiments','research_datasets','research_provenance'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY institution_isolation ON %I USING (organization_id::text = current_setting(''app.current_organization_id'', true)) WITH CHECK (organization_id::text = current_setting(''app.current_organization_id'', true))',
      table_name
    );
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_appeal_per_submission ON grade_appeals (organization_id, submission_id) WHERE status IN ('open','under_review');
CREATE INDEX IF NOT EXISTS appeals_queue_idx ON grade_appeals (organization_id, status, created_at);
CREATE INDEX IF NOT EXISTS grade_history_submission_idx ON grade_history (organization_id, submission_id, recorded_at);
CREATE INDEX IF NOT EXISTS exports_queue_idx ON academic_exports (organization_id, status, created_at);
CREATE INDEX IF NOT EXISTS lab_sessions_expiry_idx ON lab_sessions (state, expires_at);
CREATE INDEX IF NOT EXISTS research_experiments_queue_idx ON research_experiments (organization_id, status, created_at);
CREATE INDEX IF NOT EXISTS research_provenance_project_idx ON research_provenance (organization_id, project_id, occurred_at);
