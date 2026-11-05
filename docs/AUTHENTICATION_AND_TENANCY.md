# Authentication and Institution Isolation

## Scope of this implementation slice

The API foundation adds server-side sign-in, opaque cookie sessions, institution membership checks, persistent login throttling, and a PostgreSQL schema with row-level institution policies. It does not yet provide account invitation, password reset, MFA, SSO/SAML/OIDC, institutional provisioning, or the academic dashboard APIs.

## Runtime

- Run the API as a separate Node.js service from the Vite static frontend.
- Configure `DATABASE_URL`, `PORT`, `NODE_ENV`, and the exact frontend `APP_ORIGIN`.
- Use TLS at the ingress and set `DATABASE_SSL=true` only when the database endpoint requires verified TLS.
- Apply `db/migrations/001_university_core.sql` using a migration identity before starting the API.
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

Protected data access must use `withInstitution(verifiedMembership.organizationId, callback)`. The organization ID must come from a verified server session and active membership, never directly from request JSON, query parameters, or browser storage.

The API runtime database role must not own tables, bypass row-level security, or inherit the migration role. RLS is not a substitute for authorization: each future endpoint must also check role, cohort membership, resource ownership, and operation-specific permissions.

## API errors and operational requirements

Responses are JSON with no-store caching and basic browser security headers. Request bodies are bounded. The API does not enable permissive CORS. Configure an exact `APP_ORIGIN`; use a same-origin reverse proxy where possible.

Before institutional pilot:
- Add invitation and account recovery flows with one-time, hashed, expiring tokens.
- Add MFA and institution SSO based on each institution's identity requirements.
- Add CSRF protection for any future cross-site cookie deployment; retain strict same-site cookies and exact origin checks.
- Add session rotation, device/session management, and security notifications.
- Add integration tests using two real PostgreSQL institutions and prove read/write isolation under the runtime role.
- Add an audited bootstrap/provisioning command and an operational account recovery process.
- Add privacy retention, consent, export, and deletion workflows.

No real institution account is provisioned by this code alone. No user-facing login is considered deployable until a secure institution bootstrap and integration test are completed.
