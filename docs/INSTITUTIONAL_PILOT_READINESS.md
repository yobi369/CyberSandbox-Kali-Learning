# Institutional Pilot Discovery and Acceptance Pack

## Purpose and current planning inputs

Use this pack to convert an institution's requirements into an evidenced pilot decision. It does not assert that an institution has approved the product or that any release gate is complete.

Known planning inputs:

- Institution: not selected.
- Intended audience: a large cohort; exact learner, instructor, staff, and concurrent-user counts are unknown.
- Target date: flexible and not set.
- Hosting provider, data residency, procurement path, and budget: not selected or confirmed.
- Desired product scope: simulator plus live isolated labs eventually.

**Recommended release sequence:** prepare and validate the simulator first; pilot with a bounded cohort; keep live labs disabled until a separate worker deployment has passed all technical and institutional gates. Do not select infrastructure, promise capacity, or estimate cost until concurrency, residency, availability, and procurement requirements are known. The current live-session API fails closed with HTTP 503.

## 1. Institution discovery worksheet

Complete these decisions with the institution's accountable owners before deployment or real learner-data collection.

### Governance and ownership

- Institution name, country/region, and approved data-residency locations:
- Executive sponsor and product owner:
- Academic approver and course/module owner:
- IT identity and hosting owner:
- Security reviewer and incident-response contact:
- Privacy/data-protection contact and records-retention authority:
- Accessibility contact and learner-support owner:
- Procurement approver and available operating budget:

### Pilot population and service needs

- Learners, instructors, teaching assistants, administrators, and lab operators:
- Expected concurrent users and peak class/session times:
- First-cohort size and criteria for expanding to the larger cohort:
- Learner device/browser mix, assistive technology, and low-bandwidth requirements:
- Required availability, support hours, response targets, and recovery objectives:
- Expected academic calendar, pilot duration, and success measures:

### Identity, privacy, and records

- Identity provider and SSO/MFA requirements:
- Account invitation, recovery, suspension, and offboarding process:
- Personal and academic data collected, purpose, access roles, and lawful basis:
- Retention, deletion, correction, export, and legal-hold requirements:
- Audit-log access, review, and retention policy:
- Approved email, domain, DNS, and notification services:
- Required privacy, security, accessibility, and acceptable-use approvals:

### Academic scope

- Course codes, learning outcomes, prerequisites, and term:
- Educator-approved lessons, lab fixtures, references, answer guidance, and rubrics:
- Whether assignments are formative or graded; human moderation and appeal policy:
- Required LMS integration, roster import/export, and gradebook format:
- Approved evaluation measures and who will review pilot feedback:

The local heuristic assessment is formative and must not be used for consequential grading. University course mappings and content require institutional educator review.

### Hosting and live-lab scope

- Approved hosting vendors/accounts, network boundaries, data residency, and procurement constraints:
- API/database hosting, backup encryption, tested restore schedule, monitoring, and on-call ownership:
- Whether live execution is required for the initial pilot or a later separately approved phase:
- If live labs are planned: approved image owner, fictional/disposable target scope, lab operator, worker-host owner, network policy, session quota, expiry, and shutdown contact:
- Prohibited targets and routes (including public internet, institution networks, cloud metadata, production systems, and other tenants):
- Maximum per-session CPU, memory, disk, duration, and concurrent session count:

Live exercises must be limited to institution-approved, disposable lab targets. No public target scanning or unrestricted egress is in scope.

## 2. Staged rollout and acceptance gates

| Gate | Scope | Required evidence before proceeding |
|---|---|---|
| 0. Institution discovery | Confirm owners, policy, intended learning outcomes, cohort size/concurrency, identity, data handling, hosting constraints, and operating budget. | Completed worksheet; named accountable owners; written approval of pilot scope and success measures. |
| 1. Product and content preparation | Reproducible build, accessible core journeys, reviewed simulator content, privacy/acceptable-use/support materials, and tested account workflows. | CI evidence; keyboard/screen-reader/mobile review; educator sign-off; approved privacy and retention documents; incident contact. |
| 2. Private simulator staging | Deploy same-origin frontend/API and managed PostgreSQL with synthetic data; provision test institution; keep execution disabled. | Migrations and health checks pass; login/logout/invitation checks pass; exact restricted DB runtime role is tested; backup restore is demonstrated; no live resources are created. |
| 3. Bounded institutional pilot | Invite a limited, institution-approved cohort using simulated labs only. Set a cohort size from observed workload, support capacity, and load-test results rather than the unquantified “large” target. | Real-user workflow and accessibility feedback; role and tenant authorization tests; support/incident exercise; privacy review; success metrics met and documented. |
| 4. Isolated worker qualification | In a separate non-production security boundary, validate dedicated KVM-capable workers, fixed approved images, deny-by-default networking, quotas, expiry, teardown, and crash recovery. No student access during qualification. | Independent isolation and escape assessment; IPv4/IPv6 egress-denial evidence; cross-tenant separation; resource-limit and teardown/fault-injection results; orphan reconciliation; incident and recovery drills; institution security sign-off. |
| 5. Restricted live-lab pilot | Enable a narrow set of approved exercises for a supervised cohort only after Gate 4; retain simulator mode and immediate shutdown path. | Per-session authorization and scope enforcement; tested quotas and timeouts; worker/image provenance; audit events; verified teardown; support ownership; explicit institutional go/no-go approval. |
| 6. Cohort expansion | Increase users and concurrent sessions in measured increments. | Load/capacity tests at agreed peak concurrency; error/latency and resource budgets; support and recovery evidence; review of pilot outcomes after each expansion. |

Passing CI, a healthy API, or a successful demo deployment is not evidence that tenant isolation, accessibility, academic validity, backup recovery, or worker security has passed. Keep the live-session endpoint fail-closed until its gate is approved.

## 3. Go/no-go checklist

### Simulator-only pilot

- [ ] Institution and accountable academic, IT, security, privacy, and support owners are identified.
- [ ] Pilot size and peak concurrency are quantified; hosting and operational budget are approved.
- [ ] Hosting location, identity, privacy, acceptable-use, retention, support, and incident policies are approved.
- [ ] Educators approve course mapping, content, and assessment use; heuristic scores remain formative.
- [ ] Accessibility, keyboard, screen-reader, mobile, and low-bandwidth checks are recorded.
- [ ] Staging uses synthetic data until data protection approval is complete.
- [ ] Sign-in, access revocation, invitations, tenant authorization, and exports are exercised.
- [ ] PostgreSQL isolation is verified using the exact restricted runtime role.
- [ ] Backup restoration and an incident/support escalation drill are demonstrated.
- [ ] A bounded pilot cohort, success criteria, feedback process, and expansion decision date are agreed.

### Live isolated labs (additional gate; not satisfied by this repository alone)

- [ ] Dedicated worker infrastructure is funded, separately operated, and isolated from the web/API service and production data.
- [ ] Only fixed, reviewed images and institution-approved disposable targets are reachable.
- [ ] Host-enforced deny-by-default IPv4/IPv6 networking blocks public internet, institution LAN, metadata, control plane, databases, management interfaces, and other tenants.
- [ ] Per-session authorization, short-lived capabilities, CPU/memory/disk/process/network/time limits, and independent expiry are enforced.
- [ ] Worker identity, image provenance, secrets separation, event auditing, and orphan reconciliation are verified.
- [ ] Crash injection, teardown verification, restore, incident response, and independent security testing pass.
- [ ] Institution security and academic owners approve the live-lab scope and supervised rollout in writing.

## 4. Current product constraints

- No institution or production API is configured or provisioned.
- The simulator's progress and formative feedback are stored locally in the browser.
- The university API has academic and identity workflows but has not been accepted against an institution's policies or tested in institutional staging.
- Live sessions return HTTP 503; no Kali VM or live worker is provided.
- Research workspaces and experiments are metadata only; no research compute or artifact storage is connected.
- A “large cohort” is not a capacity target until user counts, concurrency, workload, support, and budget are defined.

For implementation and deployment details, see [University readiness](./UNIVERSITY_READINESS.md), [deployment acceptance](./DEPLOYMENT_ACCEPTANCE.md), [authentication and tenancy](./AUTHENTICATION_AND_TENANCY.md), [isolated worker runbook](./ISOLATED_KALI_WORKER_RUNBOOK.md), and [quality assurance](./QUALITY_ASSURANCE.md).
