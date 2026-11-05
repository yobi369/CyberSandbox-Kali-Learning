# API Deployment and First Institution Setup

The API is a separate Node.js service. It must not share a process or filesystem with student lab workers.

## Build and run

- Node.js 22+
- PostgreSQL 15+
- Install dependencies with `npm install`.
- Build with `npm run api:build`.
- Apply the versioned schema with `npm run db:migrate`.
- Start with `npm run api:start`.

Required runtime configuration:
- `DATABASE_URL`: private PostgreSQL connection string.
- `APP_ORIGIN`: exact HTTPS origin of the frontend, with no trailing slash.
- `NODE_ENV=production`.
- `PORT`: service port, default 4000.
- `DATABASE_SSL=true` only for a database requiring verified TLS.

Run migrations with a separate deployment database identity. Run the API with a non-owner role that has only the required DML privileges and cannot bypass row-level security. Do not grant the runtime role schema ownership, superuser, or BYPASSRLS.

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

- `POST /api/auth/login`, `GET /api/auth/session`, and `POST /api/auth/logout`.
- `GET /api/dashboard` returns database-backed metrics for students, lecturers, or institution administrators.
- `GET /api/courses` and `GET /api/courses/:id/pathway` provide published course and learning-pathway reads within the verified institution.
- `POST /api/enrolments` allows a student to enrol in an open cohort.
- `GET /api/assignments`, `POST /api/assignments`, and `POST /api/assignments/:id/submissions` support assignment discovery, lecturer/admin creation, and student submissions.
- `POST /api/submissions/:id/assessments` records a lecturer assessment; `POST /api/assessments/:id/moderate` records a separate moderation decision.

## Current limitations

This is the first identity and tenant-schema slice, not a complete identity product. Invitation, password recovery, MFA, SSO, admin account lifecycle, dashboard APIs, and full authorization policies for academic operations remain future work. Integration tests against PostgreSQL with two institutions are required before pilot use.
