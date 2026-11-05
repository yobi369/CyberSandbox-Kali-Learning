# CyberSandbox — University Cybersecurity Learning and Research Platform

CyberSandbox is being developed into a structured cybersecurity education and research platform for undergraduate BIT / computing learners, postgraduate MIT-level learners, lecturers, and lab administrators. The current product is a browser-based learning environment with deliberately simulated terminal exercises.

> **Current capability boundary:** This repository currently contains a front-end simulator, not a Kali Linux virtual machine or production university LMS. It does not execute shell commands, launch Kali tools, send network packets, brute-force credentials, exploit hosts, authenticate institutional users, or provide isolated operating-system containers. Terminal results are seeded educational examples.

## Current implementation

- React + TypeScript single-page learning interface.
- Three curated guided labs spanning Linux foundations, reconnaissance, and defensive web review.
- Simulated command prompt with a small, explicitly documented command set.
- Local browser progress persistence.
- Evidence-based lab assessments with per-lab weighted rubrics and criterion-level feedback.
- Transparent local heuristic assessment across evidence quality, technical reasoning, confidence/limitations, and remediation quality.
- Scenario-specific assessment rubrics and regression benchmarks for strong, weak, keyword-stuffed, overconfident, and unsafe findings.
- Nine structured deep-dive lessons with prerequisites, concept explanations, command anatomy, worked examples, interpretation boundaries, evidence practice, common mistakes, defensive relevance, guided exercises, independent challenges, knowledge checks, and references.
- Responsive workspace, bounded terminal history, and browser-native text-to-speech where supported.

The assessment evaluator is formative only. It uses textual and structural heuristics, is not a semantic expert, cannot verify claims, and must not be used for formal grades, certification, hiring, or other consequential decisions.

## Safety boundaries

- All current targets and outputs are fictional training data.
- No command is passed to the host operating system or a shell.
- Network, password-guessing, exploit, and web-scanning commands are never executed.
- AI provider calls are disabled in the browser. Do not add API keys to Vite client environment variables or commit secrets.
- Any future live execution must be a separate, opt-in subsystem with explicit authorization, isolated disposable environments, deny-by-default networking, quotas, audit, and verified teardown.

## University and research direction

The target product has two complementary tracks:

1. **Cybersecurity education:** structured learning pathways, practical labs, assignments, rubric-based feedback, instructor moderation, cohort management, and learning analytics.
2. **Cybersecurity research:** isolated experiments, versioned environments, reproducible methods, provenance, datasets, and independent reproduction workflows.

The proposed curriculum distinguishes undergraduate BIT foundations and progression from postgraduate MIT-level advanced investigation and research. These are adaptable curriculum proposals, not accredited syllabi or claims of institutional approval.

## Product readiness documentation

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

The GitHub Actions workflow runs TypeScript validation, unit tests, and the production build. A passing CI run does not establish academic validation, accessibility conformance, security isolation, or university readiness.

## Current release status

The current simulator is a demonstration and formative-practice foundation. It is not yet a university pilot release, live cybersecurity lab, formal assessment system, or research platform. The release gates in docs/UNIVERSITY_READINESS.md and docs/QUALITY_ASSURANCE.md must be evidenced before those claims can be made.

## Development sequence

1. Complete simulator correctness, curriculum integrity, accessibility, and repeatable CI.
2. Build server-side identity, organization/tenant isolation, and authoritative learning records.
3. Build instructor, cohort, assignment, submission, moderation, and export workflows.
4. Validate assessment quality with independent educators; keep human moderation for consequential outcomes.
5. Pilot disposable isolated lab infrastructure separately from the web application.
6. Independently validate network restrictions, resource quotas, failure recovery, and teardown.
7. Add research experiment provenance and reproducibility after the teaching platform is reliable.

Planned features are not implemented unless explicitly described in the current implementation section.

## License

No license has been selected yet. Until a license is added, the repository's contents remain subject to default copyright rules. Do not assume the project is open source for reuse.
