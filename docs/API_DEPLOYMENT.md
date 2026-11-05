# API Deployment and First Institution Setup

The API is a separate Node.js service. It must not share a process or filesystem with student lab workers.

## Build and run

- Node.js 22+
- PostgreSQL 15+
- Install dependencies with `npm install` (the repository currently does not commit a lockfile).
- Build with `npm run api:build`.
- Apply both versioned migrations with `npm run db:migrate` (001 core university schema; 002 academic governance, lab control-plane and research provenance).
- Start with `npm run api:start`.

Required runtime configuration:
- `DATABASE_URL`: private PostgreSQL connection string.
- `APP_ORIGIN`: exact HTTPS origin of the frontend, with no trailing slash.
- `NODE_ENV=production`.
- `PORT`: service port, default 4000.
- `DATABASE_SSL=true` only for a database requiring verified TLS.

Run migrations with a separate deployment database identity. Run the API with a non-owner role that has only the required DML privileges and cannot bypass row-level security. Do not grant the runtime role schema ownership, superuser, or BYPASSRLS. The repeatable role bootstrap is in `ops/postgres/apply-runtime-role.sh` and `ops/postgres/runtime-role.sql`; run it as the migration identity after migrations, then set the API `DATABASE_URL` to the restricted role. See `docs/DEPLOYMENT_ACCEPTANCE.md` for the staging and release gates.

## First institution

After the migration succeeds, provision the first institution administrator exactly once using the deployment console:

- `BOOTSTRAP_INSTITUTION_NAME`
- `BOOTSTRAP_INSTITUTION_SLUG`
- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_NAME`
- `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters)

Run `npm run api:provision` in a controlled one-off job. These variables are consumed by the provisioning process and must not be committed, placed in frontend variables, or retained in ordinary logs. Remove them from the deployment environment immediately after successful provisioning. The command intentionally fails if the institution or email already exists; it is not a password-reset utility.

## Container

`Dockerfile.api` builds a standalone API image. Supply the database and origin configuration at runtime. Apply migrations and bootstrap in separate one-off deployment jobs; do not automatically run schema changes or create administrator accounts every time the API starts.

## Current API surface

- Authentication and onboarding: POST /api/auth/login, GET /api/auth/session, POST /api/auth/logout, POST /api/invitations, POST /api/auth/accept-invitation. Invitations are one-time, hashed at rest, expire after seven days and are shared as manual links; no email delivery provider is connected.
- Dashboards: GET /api/dashboard provides database-backed role metrics.
- Institution directory: GET /api/admin/memberships?role=lecturer (or student/institution_admin).
- Courses: GET /api/courses, GET /api/admin/courses, POST /api/courses, POST /api/courses/:id/modules, POST /api/modules/:id/lessons, POST /api/lessons/:id/prerequisites, POST /api/courses/:id/publish, GET /api/courses/:id/pathway.
- Cohorts: GET /api/cohorts, POST /api/cohorts, POST /api/cohorts/:id/activate, POST /api/cohorts/:id/staff, POST /api/enrolments.
- Assignments: GET /api/assignments, POST /api/assignments, POST /api/assignments/:id/publish, POST /api/assignments/:id/submissions.
- Assessment: GET /api/submissions, POST /api/submissions/:id/assessments, GET /api/assessments/pending, POST /api/assessments/:id/moderate, GET /api/submissions/:id/grades.
- Appeals: POST /api/submissions/:id/appeals, GET /api/appeals, POST /api/appeals/:id/resolve.
- Exports: GET /api/exports/gradebook.csv and GET /api/exports/cohort-roster.csv.
- Research metadata: POST /api/research/projects, POST /api/research/projects/:id/ethics-review, POST /api/research/projects/:id/workspaces, POST /api/research/workspaces/:id/experiments, GET /api/research/projects/:id/provenance.
- Lab definitions: POST /api/labs/definitions and POST /api/labs/definitions/:id/approve.

## Current limitations

The university portal and API are implementation work, not a deployed service. No institution has been provisioned and no API URL is configured. The frontend expects same-origin /api routes; deploy behind a same-origin HTTPS reverse proxy so HttpOnly SameSite=Strict cookies work as intended.

PostgreSQL migration 002 adds immutable moderated grade history, appeals, export job metadata, lab session/control-plane records, research projects/workspaces/experiments/dataset metadata and hash-linked provenance. The current CSV exports are generated synchronously; the academic_exports queue table is reserved for future asynchronous artifact generation.

Email delivery, password recovery, MFA, SSO, full account lifecycle UI, grade appeal evidence storage, object storage, dataset upload/scanning, project collaborator membership and research result artifact storage remain future work.

Live lab session creation deliberately returns HTTP 503 even if environment variables are set: no attested worker adapter is connected. Research workspace/experiment endpoints record metadata only; they do not execute code. The Firecracker/KVM runbook describes required host infrastructure and acceptance tests. Do not deploy student execution on the API host, Render web service or Vercel serverless functions.

The CI workflow now applies migrations to a disposable PostgreSQL 16 service and runs the two-institution row-level security and database role-enforcement integration test. A green CI run does not replace staging tests using the exact non-owner production database role, backup/restore validation, or independent security review.
