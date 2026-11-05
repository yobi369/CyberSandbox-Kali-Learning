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

The public demo uses three isolated free-tier components:

- **Frontend + same-origin proxy:** Cloudflare Pages Free. The Vite frontend is static; Pages Functions proxy only `/api/*` and `/health` to the API.
- **API:** Render Free Web Service, built from `Dockerfile.api`.
- **Database:** a **new, dedicated Supabase Free Postgres project** created separately by the owner. Never reuse another application's project or database.

The Pages proxy is intentional. Render's `onrender.com` service domains are separate cookie sites, so a browser cannot reliably use the existing `SameSite=Strict` session cookie directly between a Render static site and a Render API. With Pages Functions, the browser sends requests to one Pages origin; the function forwards them to Render and returns the response and `Set-Cookie` header. The browser therefore stores a host-only, Secure, HttpOnly, SameSite=Strict cookie for the Pages site. The API still validates the exact Pages origin. Do not weaken the session cookie or set a broad cookie domain.

Provider limits verified against official documentation on 2026-11-05:

- Render Free web services use 512 MB RAM, spin down after 15 minutes without inbound traffic, and have an ephemeral filesystem. The workspace receives **750 Free instance-hours per calendar month shared by all Free web services**; spun-down services do not consume hours, but exhausting the allowance suspends all Free web services until the next month. Render may also suspend a Free service that initiates unusually high outbound traffic. Free Postgres expires after 30 days, so this deployment does not create or use it. Your Render workspace already contains other Free web services, so check Billing → Monthly Included Usage before adding this API; do not deploy if the remaining allowance is insufficient. See [Render's free plan limits](https://render.com/docs/free) and [free deployment guide](https://render.com/docs/your-first-deploy).
- Cloudflare Pages Free serves static assets without a per-request charge. Pages Functions count against the Workers Free allowance of 100,000 requests per day; the free allowance resets daily. The Pages routing file limits Function execution to API and health requests so static assets do not consume that allowance. If the Function quota is exhausted, configure the project to fail closed for these critical routes. See [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/), [routing and invocation rules](https://developers.cloudflare.com/pages/functions/routing/), and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).
- Supabase Free provides 500 MB database size per project and up to two active Free projects across the user's organizations. Free projects may pause after a week of low activity, and the Free plan does not include automatic backups. Check the current organization/project quota before creating anything. See [Supabase billing and plan limits](https://supabase.com/docs/guides/platform/billing-on-supabase) and [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

**No-charge rule:** Do not add a payment method, select a paid plan, enable paid add-ons, or approve an upgrade. Keep Cloudflare on Workers Free (do not enable the $5/month Workers Paid plan) and Render on Free. If a setup screen asks for payment details or shows a paid plan, stop. Free quotas and provider policies can change; re-check provider dashboards before creating resources.

### Deploy sequence (manual approval gate)

1. In Supabase, create a new project named `CyberSandbox Demo` under an organization that has a remaining Free project slot. Select the Free plan and a region close to Render Frankfurt if available. Do not use the existing Supabase project for any other application. If there is no free project slot, stop; do not upgrade or delete another project to make room.
2. In Supabase Project Settings → Database, copy the **Session pooler** connection string from the Connect dialog. It supports IPv4-only networks; direct database connections are IPv6-only on Free unless an IPv4 add-on is purchased. Keep the migration-owner username and password private. Session-pooler usernames use the project-reference suffix; startup preserves it when switching to the restricted runtime role. See [Supabase connection methods](https://supabase.com/docs/guides/database/connecting-to-postgres).
3. In Cloudflare, create a **Pages** project by connecting this GitHub repository. Use the production branch `main`, build command `npm run build`, and output directory `dist`. Keep the project on the Free plan. The `functions/` directory is deployed automatically with Pages; `public/_routes.json` restricts Function invocation to `/api/*` and `/health`. Note the exact public origin, for example `https://cybersandbox-demo.pages.dev`.
4. In Render, create a Blueprint from this repository and choose `render.free.yaml`. Review the resource summary before confirming: it must show **only one Free web service** named `cybersandbox-api-free`, and **no database, static site, paid instance, disk, worker, cron job, or add-on**. If Render does not clearly show Free for the API service, cancel.
5. Supply the API service's secret environment values:
   - `MIGRATOR_DATABASE_URL`: the dedicated Supabase Session pooler connection string.
   - `CYBERSANDBOX_APP_PASSWORD`: a newly generated random alphanumeric password of at least 32 characters for the restricted `cybersandbox_app` role.
   - `DATABASE_SSL_CA_BASE64`: the Base64-encoded Supabase database root CA certificate. Download the certificate from Supabase Database Settings → SSL Configuration. On Linux, encode it with `base64 -w0 prod-ca-2021.crt`; on PowerShell, use `[Convert]::ToBase64String([IO.File]::ReadAllBytes("prod-ca-2021.crt"))`. Store the resulting value as the API secret.
   - `APP_ORIGIN`: the exact Cloudflare Pages origin, such as `https://cybersandbox-demo.pages.dev` (no trailing slash).
   Never put either database password or the CA value in a frontend/Vite variable.
6. After Render creates the API service, set the Cloudflare Pages **runtime** variable `API_ORIGIN` to the exact HTTPS origin shown for the new Render API service (for example, `https://cybersandbox-api-free.onrender.com`). This is a public origin, not a secret. Redeploy Pages so the Functions receive the variable. Do not set `VITE_API_ORIGIN`; browser requests must remain relative and same-origin.
7. On each API start, the container verifies the Supabase CA and hostname for both migrations and role provisioning, runs migrations under the migration-owner connection, provisions/rotates the restricted `cybersandbox_app` role, derives the runtime connection URL, removes migration credentials from the API process environment, and only then starts the server. A PostgreSQL advisory lock serializes concurrent migration attempts. The API health check requires all three migrations and, in production, verifies that the connected role is `cybersandbox_app`.
8. After the API reports healthy, create the first synthetic institution administrator once from a trusted local checkout. Build the API, then run `npm run api:provision` with `DATABASE_URL` set to the dedicated Supabase session-pooler URL using username `cybersandbox_app.<project-ref>` and the runtime-role password. Also set `DATABASE_SSL=true`, `DATABASE_SSL_CA_BASE64`, `BOOTSTRAP_INSTITUTION_NAME`, `BOOTSTRAP_INSTITUTION_SLUG`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and a unique `BOOTSTRAP_ADMIN_PASSWORD` of at least 12 characters. Run this one-shot command only once; it creates an institution, administrator and membership. Keep all secrets in an ignored local environment file or shell environment and never commit them.
9. Use only synthetic users, courses, assignments and research records. Test sign-in, session retrieval, sign-out, and a second synthetic institution. Do not load real student data, credentials, or institutional records.

### Deployment acceptance checks

- CI runs a real API integration test against PostgreSQL: database readiness and all three migrations, exact-origin CORS/preflight behavior, rejection of an unapproved origin, positive synthetic-admin login, session-cookie retrieval, and unauthenticated request rejection.
- CI tests the Pages proxy preserves the request's `Origin` and cookie, forwards path/query/body, preserves the upstream `Set-Cookie`, and disables caching.
- The existing PostgreSQL integration test checks that a restricted tenant role cannot read or write another institution's rows and rejects invalid membership-role writes.
- The API's production `/health` endpoint returns healthy only when it is connected as `cybersandbox_app` and all three migrations are present.
- Repeat the browser sign-in/session test against the deployed Pages URL. Confirm the browser stores the API's Secure HttpOnly cookie on the Pages origin and that requests to `/api/*` remain same-origin.
- Confirm no real data exists and the live lab-session endpoint still returns HTTP 503. The demo does not provision Kali VMs, Firecracker, KVM workers, student-code execution, or lab networks.

If any check fails, keep the deployment private/unshared and repair it before inviting testers. Do not upgrade to fix a free-tier limitation; pause or remove the demo instead.

## 3. Security and research boundaries

- Public access is for the learning portal and simulated workflows only.
- Keep live lab session creation fail-closed (HTTP 503). Do not provision Kali VMs, Firecracker, KVM workers, student-code execution, or lab networks on a general-purpose free web service.
- Do not upload real student records, credentials, sensitive institutional data, or private research datasets to a free demo.
- Do not claim production readiness, durable backups, high availability, or tenant-isolation acceptance based only on a demo deployment.
- Back up any demo data you need to retain; free-tier services can pause, restart, or change their limits.
