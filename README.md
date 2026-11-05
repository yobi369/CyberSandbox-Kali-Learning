# CyberSandbox — University Cybersecurity Learning and Research Platform

CyberSandbox is being developed into a structured cybersecurity education and research platform for undergraduate BIT / computing learners, postgraduate MIT-level learners, lecturers, and lab administrators. The current product is a browser-based learning environment with deliberately simulated terminal exercises.

> **Current capability boundary:** The repository now contains a university portal UI and a PostgreSQL-backed API implementation, but the API is not deployed and no institution has been provisioned. The local training terminal remains simulated: it does not execute shell commands, launch Kali tools, send network packets, brute-force credentials, exploit hosts, or provide isolated operating-system containers. Live Kali and research compute remain disabled.

## Current implementation

- React + TypeScript single-page learning interface.
- Three curated guided labs spanning Linux foundations, reconnaissance, and defensive web review.
- Simulated command prompt with a small, explicitly documented command set.
- Local browser progress persistence.
- Evidence-based lab assessments with per-lab weighted rubrics and criterion-level feedback.
- Transparent local heuristic assessment across evidence quality, technical reasoning, confidence/limitations, and remediation quality.
- Scenario-specific assessment rubrics and regression benchmarks for strong, weak, keyword-stuffed, overconfident, and unsafe findings.
- Nine structured deep-dive lessons with prerequisites, concept explanations, command anatomy, worked examples, interpretation boundaries, evidence practice, common mistakes, defensive relevance, guided exercises, independent challenges, knowledge checks, and references.
- Responsive simulator workspace, bounded terminal history, and browser-native text-to-speech where supported.
- Institution login UI and role-aware student, lecturer, and administrator dashboards.
- PostgreSQL API for institution-scoped dashboards, course/version/module/lesson administration, prerequisite validation, cohort creation/activation, lecturer assignment, enrolment, assignment publishing, submissions, assessment and moderation.
- Student grade appeals, immutable moderated grade history, CSV gradebook/cohort exports, research project ethics review, experiment metadata, and hash-linked research provenance.
- PostgreSQL migrations for institution isolation, academic role constraints, immutable published curricula, grade history, lab control-plane records, and research provenance.

The assessment evaluator is formative only. It uses textual and structural heuristics, is not a semantic expert, cannot verify claims, and must not be used for formal grades, certification, hiring, or other consequential decisions.

## Safety boundaries

- All current targets and outputs are fictional training data.
- No command is passed to the host operating system or a shell.
- Network, password-guessing, exploit, and web-scanning commands are never executed.
- AI provider calls are disabled in the browser. Do not add API keys to Vite client environment variables or commit secrets.
- Live lab session creation currently fails closed with HTTP 503. Lab definitions can be registered and reviewed, but no VM is provisioned. Any future live execution must use a separate, opt-in worker subsystem with explicit authorization, isolated disposable environments, deny-by-default networking, quotas, audit, and verified teardown.
- Research workspaces and experiments are currently metadata records; there is no connected scheduler, object store, notebook runtime, or compute worker.

## University and research direction

The target product has two complementary tracks:

1. **Cybersecurity education:** structured learning pathways, practical labs, assignments, rubric-based feedback, instructor moderation, cohort management, and learning analytics.
2. **Cybersecurity research:** isolated experiments, versioned environments, reproducible methods, provenance, datasets, and independent reproduction workflows.

The proposed curriculum distinguishes undergraduate BIT foundations and progression from postgraduate MIT-level advanced investigation and research. These are adaptable curriculum proposals, not accredited syllabi or claims of institutional approval.

## Product readiness documentation

- [Isolated Kali worker deployment runbook](docs/ISOLATED_KALI_WORKER_RUNBOOK.md) — dedicated KVM host requirements, Firecracker design, network isolation, teardown, and security acceptance tests.
- [Postgraduate research environments](docs/POSTGRADUATE_RESEARCH_ENVIRONMENTS.md) — ethics, experiment manifests, provenance, reproducibility and execution gates.
- [API deployment and first institution setup](docs/API_DEPLOYMENT.md) — separate API service, migrations, and controlled institution bootstrap.
- [Authentication and institution isolation](docs/AUTHENTICATION_AND_TENANCY.md) — server-side sessions, role membership, PostgreSQL row-level security, and remaining identity gates.
- [University readiness and adoption standard](docs/UNIVERSITY_READINESS.md) — readiness levels, safety requirements, adoption checklist, and current honest status.
- [University curriculum map](docs/CURRICULUM_MAP.md) — proposed undergraduate and postgraduate pathways and lab content standard.
- [Lab platform architecture](docs/LAB_PLATFORM_ARCHITECTURE.md) — target backend, tenant boundaries, isolated lab orchestration, data model, and security requirements.
- [Instructor platform specification](docs/INSTRUCTOR_PLATFORM_SPEC.md) — roles, learner/instructor workflows, assessment governance, privacy, and accessibility.
- [Quality assurance and release gates](docs/QUALITY_ASSURANCE.md) — automated, academic, accessibility, security, and operational validation.
- [Architecture](docs/ARCHITECTURE.md) — current system and trust boundaries.
- [Security notes](docs/SECURITY.md) — current threat model and mandatory requirements before real execution.
- [Assessment design](docs/ASSESSMENT.md) — current scoring mechanics, limitations, benchmarks, and validation requirements.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Validation

```bash
npm run typecheck
npm test
npm run build
npm run check
```

The GitHub Actions workflow builds the API, applies migrations to a real PostgreSQL service, runs unit and tenant-isolation/role-enforcement integration tests, and builds the frontend. A passing CI run does not establish academic validation, accessibility conformance, VM isolation, or university readiness.

## Current release status

The current branch contains an initial university application implementation, including a portal UI, server-side authentication API, PostgreSQL tenant schema, academic workflows, appeals, exports, and research metadata. These components are not yet deployed or pilot-ready. PostgreSQL integration tests are being added to CI. No institution is provisioned, no API endpoint is deployed, no live Kali VM exists, and no research experiment is executed by this platform. It is not yet a university pilot release or an accredited assessment/research environment. The release gates in docs/UNIVERSITY_READINESS.md and docs/QUALITY_ASSURANCE.md must be evidenced before those claims can be made.

## Development sequence

1. Complete simulator correctness, curriculum integrity, accessibility, and repeatable CI.
2. Complete PostgreSQL integration coverage for two institutions, role boundaries, migrations, session lifecycle, and grade/appeal invariants.
3. Finish account invitations/recovery/MFA/SSO, institution onboarding, course version editing, collaborator management, and full instructor/student workflows.
4. Deploy the API and database behind a same-origin HTTPS route only after selecting a hosting/database plan and reviewing operational costs.
5. Provision dedicated KVM-capable lab workers, implement the Firecracker controller and gateway, and pass the independent isolation/teardown gates.
6. Connect research object storage and isolated CPU/GPU workers; validate reproducibility and data provenance with independent researchers.

Planned features are not implemented unless explicitly described in the current implementation section.

## License

No license has been selected yet. Until a license is added, the repository's contents remain subject to default copyright rules. Do not assume the project is open source for reuse.
