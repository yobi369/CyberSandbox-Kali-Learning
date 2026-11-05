# Execution Control Plane Contracts

## Status

This change adds provider-neutral contracts and validation only. It does not install Firecracker, create a worker host, configure a firewall, connect object storage, scan uploaded files, or execute a research job. Live lab creation must continue to fail closed until an independently operated provider is integrated and security acceptance tests pass.

## Kali worker protocol

A control-plane job is versioned, tenant-scoped through its lab request, bound to an explicit worker audience, and signed with HMAC-SHA-256. Signatures are compared in constant time. Jobs are short lived (at most five minutes), reject future-issued timestamps outside clock skew, and cannot be accepted by a different audience. Deployments must use a high-entropy secret delivered through a secret manager, rotate it, and keep it out of logs and job payloads.

A worker heartbeat is eligible only when it is fresh (60 seconds), healthy, has KVM, cgroup v2, seccomp and AppArmor/SELinux capability, reports pinned runtime versions, and has spare capacity. These fields are declarations, not hardware attestation. A production worker must additionally provide cryptographically verifiable host identity and measured boot/runtime evidence before it receives jobs.

The lifecycle transition guard prevents skipping directly from active to destroyed. The database remains the durable source of state. A controller must persist provider IDs, reconcile after restart, and only record destroyed after stop, destroy and provider-side absence checks have been recorded.

## Dataset intake and research result manifests

Dataset intake is quarantined by default. Metadata is acceptable only after a versioned scanner reports a clean verdict, with scan timestamp, checksum, license, consent basis and an opaque storage key. Scanner unavailability or an unknown verdict must never be interpreted as clean. The intake validator does not itself scan bytes or create an upload URL.

A completed experiment result manifest must bind the run to an immutable source commit, environment, dependency lock and worker image digest; preserve the random seed and timestamps; and list each output artifact with a content checksum, size, media type and unique storage key. Resource measurements must be non-negative integers. The validator does not prove scientific reproducibility; independent reruns and method review remain mandatory.

## Integration sequence

1. Deploy a dedicated worker controller and Firecracker host in a separate security account/network.
2. Establish mTLS worker identity, secret rotation, signed job delivery and replay-resistant durable job IDs.
3. Enforce network policy on the host/hypervisor boundary, not in guest configuration.
4. Implement an independent reconciler and crash-injection tests across every lifecycle transition.
5. Integrate private object storage with tenant-scoped, short-lived upload/download capabilities.
6. Scan quarantined objects in an isolated scanner service; reject archives with traversal, bombs, nested executables or policy violations.
7. Execute research jobs only in isolated workers; sign result manifests and verify uploaded bytes against their checksums.
8. Pass independent escape, cross-tenant, network, crash-recovery and reproduction reviews before enabling student access.

## Explicit non-goals

No API route is added to accept arbitrary uploads or run commands. No production secret, storage endpoint, worker address or provider credential is embedded in source. No tenant is allowed to use a worker based solely on a self-reported heartbeat.

## Durable queue and worker service

Migration `003_execution_control_plane.sql` adds a durable tenant-scoped execution queue, worker inventory, lease tokens, attempt limits, event history and dataset scan-state columns. The migration runner applies it after the existing university and academic migrations.

Research jobs are admitted only after the experiment is tied to the specified active project, the project has approved or not-required ethics status, source and environment digests match the experiment record, and every dataset is available with a clean scan result and matching checksum. Admission stores a SHA-256 digest of the canonical request payload and appends an audit-chain event.

The worker-facing queue functions are in `server/research/queue.ts`. Set `EXECUTION_CONTROL_PLANE_ENABLED=true` only in a dedicated worker/controller process, never in the public web API environment. The controller must register workers through a privileged administrative path, heartbeat at least once per minute, and keep its database credentials separate from student-facing credentials. Worker transactions use `withResearchWorkerContext(organizationId, ...)` to set both the tenant scope and the execution-control-plane scope before marking or finishing a job.

Claims use PostgreSQL `FOR UPDATE SKIP LOCKED`, worker health/capacity checks, short-lived hashed lease tokens, and 30–300 second leases. Expired leases are reclaimed; attempts are bounded and exhausted jobs enter dead-letter state. Failed attempts are requeued after a short backoff. The controller must renew leases while work is active, terminate work when lease renewal fails, and reconcile provider-side processes after controller restarts.

This queue is an integration foundation, not a running worker service. No endpoint or worker registration credential is exposed to students. A worker must still independently validate signed manifests, enforce host-side resource/network boundaries, verify output checksums, and attest its runtime. Database job state alone is not proof that compute executed safely.
