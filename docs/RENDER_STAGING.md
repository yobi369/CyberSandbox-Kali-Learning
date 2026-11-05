# Render staging deployment

This Blueprint provisions only the CyberSandbox API and its dedicated PostgreSQL staging database. It does not provision Kali workers, Firecracker, artifact storage, or research execution.

## Resource and cost profile

- API: Render web service, `0.5c-512mb` (512 MB), currently listed at **US$7/month**.
- PostgreSQL: Render Postgres, `0.1c-256mb` (256 MB), currently listed at **US$6/month**, plus any storage beyond the included amount.
- Expected baseline: **about US$13/month**, before taxes, usage, or optional storage. Render bills usage according to its current pricing; verify the plan in the Blueprint review before approval.
- Both resources are placed in Frankfurt. The database has an empty public IP allow-list, so it accepts private-network connections only.
- This is a small staging footprint, not a production capacity recommendation.

## Deployment sequence

1. Create the Blueprint from `render.yaml` and inspect the planned resources and costs before approving.
2. Confirm that the database is a new resource named `cybersandbox-staging-db`; never select or import the ShuleLedger database.
3. Approve only the two staging resources after reviewing the plan.
4. Set `APP_ORIGIN` to the exact HTTPS frontend origin in the Render service environment. Do not use a wildcard.
5. Render generates `CYBERSANDBOX_APP_PASSWORD` as a secret and supplies the private database connection string as `MIGRATOR_DATABASE_URL`.
6. The service pre-deploy command applies migrations with the migration identity, then provisions the restricted `cybersandbox_app` role.
7. The container entrypoint derives a connection URL for `cybersandbox_app`, then removes `MIGRATOR_DATABASE_URL` and `CYBERSANDBOX_APP_PASSWORD` from the environment before starting the API. The Node API process receives only the restricted runtime `DATABASE_URL`.
8. Confirm `GET /health` succeeds. Then perform the staging acceptance checks below.

## Security boundaries

- The staging database is private-network only. Do not add public IP allow-list entries.
- Migrations run before the API starts, with the dedicated migration identity.
- The API process receives the non-owner `cybersandbox_app` role only.
- Database TLS verification is enabled with `DATABASE_SSL=true`.
- The API is not a worker host. Do not install Firecracker, expose KVM, run student code, or connect lab networks to this service.
- Live lab sessions must continue to return HTTP 503 until dedicated worker attestation, isolation, and teardown acceptance pass.
- Do not add credentials to the repository, build arguments, frontend variables, or logs.

## Staging acceptance

- Verify the database is private and the API uses the Render internal connection.
- Inspect PostgreSQL role attributes: no superuser, CREATEDB, CREATEROLE, BYPASSRLS, or ownership of application objects.
- Run tenant A/B read, insert, update, and delete isolation tests against the deployed API and the exact restricted role.
- Verify login, session expiry, logout, throttling, audit events, and suspended-membership revocation.
- Create an encrypted backup and perform a timed restore into a separate disposable database.
- Confirm live lab session creation returns HTTP 503 and that no VM, namespace, or network resource is created.
- Keep the environment staging-only until independent security and recovery evidence is signed off.

## Operational notes

The API container installs the PostgreSQL client solely for the role bootstrap step. The role bootstrap is idempotent and is run after migrations during each deployment. The generated runtime password is rotated by the bootstrap step; the API is restarted as part of deployment and receives the resulting restricted connection string.

Render's pre-deploy command is used for migrations and role provisioning. This requires a paid web-service plan. The service deploys only after the repository's CI checks pass.
