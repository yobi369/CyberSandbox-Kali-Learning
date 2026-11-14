# Authentication and Institution Isolation

## Scope of this implementation slice

The API foundation includes server-side sign-in, opaque cookie sessions, institution membership checks, persistent login throttling, institution invitations using manually shared links, academic dashboard APIs, and PostgreSQL row-level institution policies. It does not yet provide invitation email delivery, password recovery, MFA, SSO/SAML/OIDC, or a deployed institutional service.

## Runtime

- Run the API as a separate Node.js service from the Vite static frontend.
- Configure `DATABASE_URL`, `PORT`, `NODE_ENV`, and the exact frontend `APP_ORIGIN`.
- Use TLS at the ingress and set `DATABASE_SSL=true` only when the database endpoint requires verified TLS.
- Apply all ordered migrations with `npm run db:migrate` using a dedicated migration identity before starting the API.
- Use a least-privilege runtime database role. It must not own tenant tables or have BYPASSRLS; table ownership and migration privileges belong to a separate deployment identity.
- Do not expose PostgreSQL publicly.

## Authentication contract

- `POST /api/auth/login` accepts email, password, and institution slug.
- Credentials are checked against an active user and active membership in an active institution.
- Passwords use salted scrypt hashes; raw passwords are never stored.
- Session tokens are random opaque values. Only SHA-256 token hashes are stored in PostgreSQL.
- The session cookie is HttpOnly, SameSite=Strict, path-scoped, and Secure in production.
- Sessions expire after eight hours and are revoked server-side on logout.
- Login failures are throttled persistently per source-address/email pair.
- `GET /api/auth/session` resolves current membership and institution on the server. Browser-supplied role or institution identifiers are never authoritative.
- `POST /api/auth/logout` revokes the session.

## Tenant enforcement

Every tenant-owned academic table includes `organization_id`, composite foreign keys prevent cross-institution parent references, and PostgreSQL row-level security compares the row tenant with the transaction-local `app.current_organization_id` setting.

Protected data access must use the API's `inTenant(verifiedSession, callback)` wrapper, which rechecks active membership inside the transaction before setting the transaction-local RLS context. The organization ID must come from a verified server session and active membership, never directly from request JSON, query parameters, or browser storage. PostgreSQL triggers additionally validate institution roles for enrolments, lecturer assignments, submissions, course versions, assessments, appeals, research records and lab ownership.

The API runtime database role must not own tables, bypass row-level security, or inherit the migration role. RLS is not a substitute for authorization: each future endpoint must also check role, cohort membership, resource ownership, and operation-specific permissions.

## Academic API slice

The authenticated API now exposes role dashboards, course/module/lesson administration, immutable course publication, prerequisite-aware pathway completion, cohort creation/activation, lecturer assignment, student enrolment, assignment publication, submissions, assessment, independent moderation, grade history, appeals and institution-scoped CSV exports. Research project metadata, administrator ethics decisions, workspace/experiment manifests and hash-linked provenance are also implemented. The React portal is now the primary UI entry point with role-specific workspaces.

PostgreSQL migration 002 adds role-enforcement triggers, append-only grade/provenance records, immutable published curriculum, lab session/control-plane tables and research metadata. The CI workflow now runs a real PostgreSQL two-institution RLS and role-enforcement test. Do not call the platform pilot-ready until the latest CI run passes and the same tests are run using the exact non-owner runtime role in staging.

## API errors and operational requirements

Responses are JSON with no-store caching and basic browser security headers. Request bodies are bounded. The API does not enable permissive CORS. Configure an exact `APP_ORIGIN`; use a same-origin reverse proxy where possible.

Before institutional pilot:
- Integrate invitation delivery and account recovery with one-time, hashed, expiring tokens.
- Add MFA and institution SSO according to the adopting institution's identity requirements.
- Add CSRF protection for any future cross-site cookie deployment; retain strict same-site cookies and exact origin checks.
- Add session rotation, device/session management, and security notifications.
- Run the existing PostgreSQL integration tests using two institutions and the exact non-owner production runtime role; extend coverage across all API routes and read/write operations.
- Exercise the existing one-time bootstrap/provisioning command and define an operational account recovery process.
- Add privacy retention, consent, export, and deletion workflows.

No real institution account is provisioned and the API is not deployed. The portal expects same-origin /api routing. Invitation email delivery, password recovery, MFA, SSO, complete user lifecycle management, and production session/device management remain future work. Live Kali sessions and research compute are disabled; their schemas and metadata APIs do not provision or execute workloads.
