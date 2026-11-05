# Local development and no-cost public demo

This project supports two separate environments. The local environment is the dependable development and integration-test environment. A public free-tier environment is only a demonstration and must not contain real student data or be used for live Kali execution.

## 1. Local environment (Docker Compose)

Requirements:

- Docker Engine with the Compose plugin (or Docker Desktop with Compose).
- Git and an internet connection for the initial image and npm dependency downloads.
- Enough free disk space for PostgreSQL data and Docker images.

Start:

1. Copy `.env.example` to `.env`.
2. Replace both values with different, randomly generated alphanumeric secrets. Use at least 32 characters for the PostgreSQL password and 48 for the application-role password. Avoid punctuation in these two values because they are embedded in local connection URLs.
3. Run `docker compose up --build`.
4. Open the frontend at http://localhost:3000. The API health endpoint is http://localhost:4000/health.

The one-shot bootstrap container applies the existing SQL migrations using the database owner, then provisions the restricted `cybersandbox_app` role. The API entrypoint derives a connection URL for that role and removes the migration-owner credentials before starting the Node process. The PostgreSQL data is kept in the named `cybersandbox_pgdata` volume.

Useful commands:

- Stop containers but keep data: `docker compose down`
- Stop and erase the local database permanently: `docker compose down -v`
- View API logs: `docker compose logs -f api`
- Re-run migrations and role provisioning after a schema change: `docker compose run --rm bootstrap`
- Rebuild and restart: `docker compose up --build`

The API and frontend ports are bound to 127.0.0.1, not exposed to your LAN or the public internet. Do not change that binding for a public demo.

## 2. Public no-cost demonstration

The checked-in `render.free.yaml` defines two separate free services and deliberately creates **no database**:

- `cybersandbox-web-free`: Render Static Site (free), built from `npm run build`.
- `cybersandbox-api-free`: Render Web Service (free), built from `Dockerfile.api`.
- Database: a **new, dedicated Supabase Free Postgres project** created separately by the owner. Never reuse another application's project or database.

Provider limits verified against official documentation on 2026-11-05:

- Render offers free static sites and free web services. Free web services use 512 MB RAM, spin down after 15 minutes without inbound traffic, and take about a minute to wake. Their filesystem is ephemeral. Free web services have 750 instance-hours per workspace each month. Render may suspend free services if unusually high outbound traffic is initiated; database/API traffic counts toward this risk. Free services are suitable only for a small demo, not production. Render's Free Postgres expires after 30 days, so this blueprint does not create or use it. See [Render's free plan limits](https://render.com/docs/free).
- Supabase Free provides 500 MB database size per project and up to two active Free projects across the user's organizations. Free projects may pause after a week of low activity. There are no automatic backups on the Free plan. Check the current organization/project quota before creating anything. See [Supabase billing and plan limits](https://supabase.com/docs/guides/platform/billing-on-supabase) and [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

**No-charge rule:** Do not add a payment method, select a paid plan, enable paid add-ons, or approve an upgrade. Render says over-quota usage can be billed when a payment method is attached; without one, services are suspended instead. If a setup screen asks for payment details or shows a paid plan, stop. Free quotas and provider policies can change; re-check the provider dashboards before creating resources.

### Deploy sequence (manual approval gate)

1. In Supabase, create a new project named `CyberSandbox Demo` under an organization that has a remaining Free project slot. Select the Free plan and a region close to the Render Frankfurt service if available. Do not use the existing Supabase project for any other application. If there is no free project slot, stop; do not upgrade or delete another project to make room.
2. In Supabase Project Settings → Database, copy the **Session pooler** connection string (not the direct connection string, which may require IPv6 support). Keep the migration-owner username and password private. Supabase session-pooler usernames commonly include the project reference suffix; the startup script preserves it when switching to the restricted runtime role.
3. In Render, create a Blueprint from this repository and choose `render.free.yaml`. Review the resource summary before confirming: it must show only one Free web service and one Free static site, and **no database, paid instance, disk, worker, cron job, or add-on**. If Render does not clearly show Free for the API service, cancel.
4. Supply the API service's secret environment values:
   - `MIGRATOR_DATABASE_URL`: the dedicated Supabase Session pooler connection string.
   - `CYBERSANDBOX_APP_PASSWORD`: a newly generated random alphanumeric password of at least 32 characters for the restricted `cybersandbox_app` role.
   - `APP_ORIGIN`: `https://cybersandbox-web-free.onrender.com` (exact origin, no trailing slash).
   Never put either database password in a frontend/Vite variable.
5. Confirm the API URL is `https://cybersandbox-api-free.onrender.com`. The static-site build receives this as `VITE_API_ORIGIN`; browser requests use credentialed fetches. The API accepts CORS requests only from the exact `APP_ORIGIN`. Both services use Render's `onrender.com` domain, so they are cross-origin but same-site; the API's host-only `Secure; HttpOnly; SameSite=Strict` session cookie is sent with credentialed requests. Do not change the cookie to a broadly scoped domain.
6. On each API start, the container runs migrations under the migration-owner connection, provisions/rotates the restricted `cybersandbox_app` role, derives the runtime connection URL, removes migration credentials from the API process environment, and only then starts the server. A PostgreSQL advisory lock serializes concurrent migration attempts. The API health check requires all three migrations and, in production, verifies that the connected role is `cybersandbox_app`.
7. After the API reports healthy, create the first synthetic institution administrator once from a trusted local checkout. Build the API, then run `npm run api:provision` with `DATABASE_URL` set to the dedicated Supabase session-pooler URL using username `cybersandbox_app.<project-ref>` and the runtime-role password. Also set `DATABASE_SSL=true`, `BOOTSTRAP_INSTITUTION_NAME`, `BOOTSTRAP_INSTITUTION_SLUG`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 12 characters. Run this one-shot command only once; it creates an institution, administrator and membership. Keep all secrets in an ignored local environment file or shell environment and never commit them.
8. Use only synthetic users, courses, assignments and research records. Test sign-in, session retrieval, sign-out, and a second synthetic institution. Do not load real student data, credentials, or institutional records.

### Deployment acceptance checks

- CI runs a real API integration test against PostgreSQL: database readiness and all three migrations, exact-origin CORS/preflight behavior, rejection of an unapproved origin, positive synthetic-admin login, session-cookie retrieval, and unauthenticated request rejection.
- The existing PostgreSQL integration test checks that a restricted tenant role cannot read or write another institution's rows and rejects invalid membership-role writes.
- The API's production `/health` endpoint returns healthy only when it is connected as `cybersandbox_app` and all three migrations are present.
- Repeat the browser sign-in/session test against the deployed URLs. Confirm the browser stores the API host's secure HttpOnly cookie and that requests include credentials.
- Confirm no real data exists and the live lab-session endpoint still returns HTTP 503. The demo does not provision Kali VMs, Firecracker, KVM workers, student-code execution, or lab networks.

If any check fails, keep the deployment private/unshared and repair it before inviting testers. Do not upgrade to fix a free-tier limitation; pause or remove the demo instead.
 
## 3. Security and research boundaries

- Public access is for the learning portal and simulated workflows only.
- Keep live lab session creation fail-closed (HTTP 503). Do not provision Kali VMs, Firecracker, KVM workers, student-code execution, or lab networks on a general-purpose free web service.
- Do not upload real student records, credentials, sensitive institutional data, or private research datasets to a free demo.
- Do not claim production readiness, durable backups, high availability, or tenant-isolation acceptance based only on a demo deployment.
- Back up any demo data you need to retain; free-tier services can pause, restart, or change their limits.
