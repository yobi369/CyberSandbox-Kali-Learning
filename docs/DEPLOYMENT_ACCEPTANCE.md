# Staging Deployment and Acceptance Gates

This runbook separates a merged application foundation from any institution-facing pilot. A successful build is not a production deployment.

## 1. API and PostgreSQL staging

1. Provision managed PostgreSQL in the same private network/region as the API.
2. Require verified TLS. Do not expose PostgreSQL publicly; allow connections only from the API and controlled migration runner.
3. Create separate migration and API runtime identities. The runtime identity must not own tables, create objects, or bypass row-level security.
4. Run migrations with the migration identity: npm ci, npm run api:build, then npm run db:migrate.
5. Run ops/postgres/apply-runtime-role.sh as the same migration identity that owns/creates schema objects. Supply the runtime password from a secret manager; never commit it or expose it to CI logs or frontend variables.
6. Set API DATABASE_URL to the restricted cybersandbox_app connection string; set DATABASE_SSL=true, NODE_ENV=production, APP_ORIGIN to the exact HTTPS frontend origin, and the platform-provided PORT.
7. Deploy the API container from Dockerfile.api. Keep API/database private where possible; expose only HTTPS ingress.
8. Check GET /health after deployment. It verifies database connectivity but is not proof of tenant isolation.
9. Provision the first institution administrator once through a protected one-off job. Remove bootstrap variables immediately afterward.

Do not use the migration identity as the API DATABASE_URL. Do not enable the execution control plane in the public API process.

## 2. Database acceptance

- Apply migrations to an empty PostgreSQL instance and to a restored backup.
- Run integration tests using the exact restricted runtime role, not only an owner or superuser.
- Prove tenant A cannot read, insert, update, or delete tenant B data across tenant-owned tables and API routes.
- Prove suspended memberships and institutions lose access immediately.
- Verify invitations, session expiry, logout, login throttling, and audit events.
- Verify the API role has rolsuper=false, rolcreatedb=false, rolcreaterole=false, rolbypassrls=false, and does not own application tables.
- Verify encrypted backups, retention, point-in-time recovery, and a timed, independently checked restore.

## 3. Worker infrastructure is separate

The API/database deployment does not provide a compute worker. Never place Firecracker, KVM guests, dataset scanners, or research execution processes in the API container or a shared web-service host.

Worker deployment remains blocked until there are dedicated KVM-capable bare-metal hosts; pinned signature-verified Firecracker/jailer binaries; hardened kernels; cgroups v2; seccomp; AppArmor/SELinux; separate management/lab interfaces; host-enforced deny-by-default IPv4/IPv6; mTLS worker identity; short-lived replay-resistant jobs; durable provider IDs; independent orphan reconciliation; and verified teardown.

Independently test guest isolation from public internet, institution LAN, cloud metadata, databases, API administration, other tenants, and worker management endpoints. Inject crashes through every provisioning and teardown state.

Until those gates pass, live lab session creation must continue to return HTTP 503.

## 4. Artifact and research execution

- Use private encrypted object storage, opaque tenant-scoped keys, versioning, lifecycle expiry, and short-lived scoped upload/download URLs.
- Uploads enter quarantine. An isolated scanner must inspect bytes, archives, file types, size, nesting, traversal, decompression bombs, and malware. Scanner outage/unknown verdict means hold or reject, never clean.
- Verify stored-object SHA-256 and bind it to the dataset record.
- Research workers receive no API or migration database credentials; use a narrow worker identity and job lease.
- Validate manifests, image digests, source commit, environment lock, seed, output checksums, and resource measurements before completion.
- Do not expose dataset upload or arbitrary code execution until storage and scanning are integrated and tested.

## 5. Release decision

A supervised pilot requires signed evidence for database/RLS tests, backup restore, security review, tenant isolation, worker escape tests, network segmentation, crash recovery, artifact scanning, and institutional operational sign-off. Green CI alone is insufficient.