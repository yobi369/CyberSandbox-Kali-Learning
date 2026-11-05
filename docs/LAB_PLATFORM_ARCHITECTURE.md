# Lab Platform Architecture

## Current implementation boundary

The repository now contains a React university portal, Node.js API, PostgreSQL migrations, server-side session authentication, tenant RLS, academic workflows and research/lab control-plane metadata. The API is not deployed and no institution is provisioned. The original terminal remains a deterministic simulator. Lab definition registration is implemented, but live session creation deliberately returns HTTP 503 because no independently attested worker provider is connected. Research workspace and experiment endpoints register metadata only; they do not execute code. This document distinguishes implemented control-plane records from the future isolated execution plane.

## Implemented control-plane slice

- Same-origin university portal UI with institution sign-in and role-aware student, lecturer and administrator workspaces.
- Node.js API with opaque cookie sessions and active membership checks inside tenant transactions.
- PostgreSQL RLS policies and role-enforcement triggers, including cross-institution composite foreign keys.
- Course versions, modules, lessons, prerequisites, cohorts, lecturer assignments, enrolments, assignments, submissions, assessment moderation, grade history, appeals and CSV exports.
- Research project metadata, administrator ethics decisions, experiment manifests and append-only hash-linked provenance.
- Lab definitions and database schema for sessions/events/quotas; live execution remains disabled.

## Target system overview

Learner / Instructor Browser
  -> Web application (untrusted client)
  -> API gateway / application backend
     -> Identity and authorization
     -> Curriculum and assignment service
     -> Assessment and moderation service
     -> Audit and observability
  -> Session orchestrator
     -> Disposable lab worker pool
        -> Isolated per-session VM/container
        -> Deny-by-default network policy
        -> Resource/time quotas
        -> Session event collector
     -> Artifact/object storage
     -> Relational database

## Architectural boundaries

### Browser
- Treat all client input and local state as untrusted.
- Never store infrastructure secrets or runtime credentials.
- Never decide authoritative grades, permissions, tenant membership, or lab authorization.
- Display whether a session is simulated, seeded, or live.
- Use accessible controls and provide keyboard operation.

### Application backend
- Authenticate users and authorize every resource request.
- Enforce tenant and cohort boundaries on the server.
- Validate schemas, payload size, rate limits, and ownership.
- Keep assessment, assignment, and progress state server-side.
- Issue short-lived, scoped lab-session capabilities.
- Record security-relevant events and moderation actions.

### Session orchestrator
- Create one disposable environment per authorized session.
- Use pinned, signed or otherwise verified images.
- Apply quotas before the learner receives access.
- Enforce deny-by-default network policy outside the guest.
- Prevent privileged mode, host mounts, runtime socket exposure, metadata access, and cross-session communication.
- Capture only the telemetry needed for teaching, security, and troubleshooting.
- Stop and destroy environments at expiry, explicit close, quota breach, or policy violation.
- Verify teardown and clean up orphaned resources.

### Lab workers
- Run in a dedicated worker pool or separate infrastructure boundary.
- Have no ambient cloud credentials.
- Have restricted egress and no route to production data stores.
- Use ephemeral storage by default.
- Apply CPU, memory, process, disk, and wall-clock ceilings.
- Receive only scoped session data.
- Be patched, inventoried, and scanned.

### Data services
- Use relational storage for identities, organizations, cohorts, course versions, assignments, submissions, assessment versions, and audit events.
- Store larger artifacts separately with access control, size limits, malware scanning where appropriate, and retention policies.
- Encrypt data in transit and at rest.
- Define tenant keys and enforce tenant scoping in both application queries and database policy where supported.
- Back up and test restoration on a documented schedule.

## Suggested domain model

- Organization: institution or independent training tenant.
- User: stable identity, profile, status.
- Membership: user, organization, role, lifecycle state.
- Course: institution-owned course container.
- CourseVersion: immutable curriculum snapshot.
- Module and Lesson: learning content with version and prerequisites.
- Cohort: instructor-managed group.
- Enrollment: learner-to-cohort relationship.
- LabDefinition: scenario, target mode, required image, resource policy, version.
- LabSession: owner, lab version, state, timestamps, quota, teardown result.
- Assignment: course/cohort, lab, instructions, rubric version, deadlines.
- Submission: learner work, artifact references, timestamps, status.
- Assessment: rubric version, machine feedback, human feedback, moderation state.
- AuditEvent: actor, tenant, action, resource, timestamp, outcome, correlation ID.

Every tenant-owned record must carry a server-verified organization boundary. Do not trust a tenant ID supplied by the browser without checking membership and resource ownership.

## Session lifecycle

requested -> authorized -> provisioning -> ready -> active -> stopping -> destroying -> destroyed/verified

Rejected, expired, or failed transitions must be recorded. A session must not be considered closed merely because the browser disconnected. Server-side expiry and cleanup must continue independently.

## Network policy

Default policy: no egress and no access to production networks.

Any permitted traffic must be limited to a dedicated lab subnet or explicitly approved service; constrained by source, destination, protocol, and port; unable to reach cloud metadata, control planes, private production ranges, or other tenants; logged at a level appropriate for the institution's privacy policy; and automatically removed when the session ends.

The application must not provide unrestricted internet scanning or a general-purpose attack proxy.

## Security testing requirements

Before enabling live execution:
- Test command and protocol input boundaries.
- Test cross-tenant authorization and object ownership.
- Test network egress denial and bypass attempts.
- Test container/VM escape mitigations and host-mount restrictions.
- Test CPU, memory, process, disk, and timeout enforcement.
- Kill the orchestrator and worker at provisioning, startup, runtime, and teardown boundaries.
- Verify orphan cleanup after database, network, and worker failures.
- Verify backups and restoration.
- Perform independent penetration testing of the control plane.

## Deployment strategy

Keep simulator mode independently deployable. Introduce live lab execution behind a separate feature flag and separate infrastructure boundary. Do not make the web application depend on a live lab worker to serve curriculum pages.

Roll out incrementally:
1. Complete API-level PostgreSQL integration tests, account lifecycle and institution bootstrap/deployment.
2. Complete dashboard and academic administration UI, moderation/appeals workflows and backup/restore evidence.
3. Deploy a dedicated KVM/Firecracker worker pool and session gateway outside the application host.
4. Pass network isolation, VM escape, quotas, crash recovery and verified teardown tests.
5. Connect research object storage and isolated experiment workers with immutable manifests and independent reproduction.
6. Obtain academic, privacy, accessibility and independent security sign-off before institutional pilot.

## Operational signals

Monitor authentication failures, authorization denials, provisioning latency, active sessions, resource utilization, policy violations, denied egress, teardown success, orphan count, submission and assessment failures, backup age, and restore-test status.

Never expose internal infrastructure addresses, secrets, or sensitive student content in ordinary application logs.
