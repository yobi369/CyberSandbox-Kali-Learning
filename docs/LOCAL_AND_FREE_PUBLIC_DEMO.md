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

A limited public demonstration can be attempted using a free web-service host for the API and a separate free PostgreSQL provider. A possible combination is a Render Free web service and a dedicated Supabase Free Postgres project. Create a new, dedicated database for CyberSandbox; never point it at another application or the user's unrelated Supabase project.

Important limits, checked against provider documentation on 2026-11-05:

- Render Free web services spin down after 15 minutes without inbound traffic and take about a minute to wake. Their local filesystem is ephemeral. Render Free Postgres expires after 30 days, so it is not suitable as the durable database for this project.
- Supabase Free includes a small Postgres database (500 MB) and pauses projects after a week of low activity. It does not provide a production availability guarantee.
- Free hosting quotas, policies, and availability can change. Do not add a payment method or upgrade a service just to complete this demo. If a provider asks for payment details or shows a paid plan, stop and do not approve it.

Before using this route, the deployment configuration must be adapted for the free service's startup lifecycle: migrations and restricted-role provisioning must run safely before the API accepts traffic, because the current paid Render Blueprint uses a pre-deploy command that is not available on a Free web service. The API must connect to the dedicated Supabase database over TLS, with separate migration-owner and restricted runtime credentials. The frontend must be configured to call the public API origin and the API's exact allowed frontend origin.

Do not create cloud resources automatically as part of local development. The public deployment should be a separate, explicitly reviewed step after the free-tier configuration has been tested. Never place database credentials in Vite variables or browser-delivered code.

## 3. Security and research boundaries

- Public access is for the learning portal and simulated workflows only.
- Keep live lab session creation fail-closed (HTTP 503). Do not provision Kali VMs, Firecracker, KVM workers, student-code execution, or lab networks on a general-purpose free web service.
- Do not upload real student records, credentials, sensitive institutional data, or private research datasets to a free demo.
- Do not claim production readiness, durable backups, high availability, or tenant-isolation acceptance based only on a demo deployment.
- Back up any demo data you need to retain; free-tier services can pause, restart, or change their limits.
