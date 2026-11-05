# Quality Assurance and Release Gates

## Quality model

CyberSandbox quality has five separate dimensions:
1. Software correctness and reliability.
2. Cybersecurity and safe operation.
3. Academic and technical accuracy.
4. Accessibility and usability.
5. Operational readiness and recoverability.

Passing a TypeScript build and unit tests is necessary but does not establish university readiness.

## Automated checks

Required on every change:
- TypeScript typecheck.
- Unit tests for command parsing, progress, assessment, curriculum, and policy logic.
- Production build.
- Dependency lockfile and reproducible installation.
- Secret scanning and dependency vulnerability review.
- Static analysis and code scanning.
- Accessibility checks for core workflows.
- Curriculum schema and link validation.
- Fixture tests proving simulator output remains labelled as simulated.
- Authorization tests for every server-side resource once a backend exists.

Use pinned GitHub Actions versions and least-privilege workflow permissions. Prefer a clean reproducible install with a committed lockfile over a floating dependency installation.

## Manual academic review

Each new lesson or lab needs:
- Technical reviewer sign-off.
- Educator review for level, prerequisites, outcomes, and expected workload.
- Answer-key and rubric review.
- Safety and authorization review.
- Accessibility review.
- Reference freshness check.
- Version history and changelog entry.

## Assessment validation

The current scorer is a transparent heuristic and must remain formative. A formal assessment pilot requires:
- Anonymized submissions across experience levels and writing styles.
- At least two independent human reviewers.
- Dimension-level agreement analysis.
- False-positive and false-negative analysis.
- Adversarial and keyword-stuffing cases.
- Documented evaluator limitations.
- Human moderation and appeal.
- Versioned rubric and scoring algorithm.

## Security validation

For the web application: threat-model review; authentication and authorization tests; session management and CSRF protection where applicable; input validation and output encoding; rate limiting and abuse controls; dependency, secret, and static analysis; independent security testing before institutional deployment.

For live lab execution:
- Network isolation and egress-denial tests.
- Host and cross-tenant isolation tests.
- Resource exhaustion tests.
- Worker and orchestrator crash tests.
- Provisioning and teardown fault injection.
- Orphan cleanup tests.
- Backup and restore drills.
- Incident response exercise.

## Accessibility validation

Automated tools are only a first pass. Test keyboard-only navigation, screen reader flows, browser zoom and reflow, contrast and focus visibility, reduced motion, form labels and errors, terminal output updates, assessment feedback, mobile use, and low-bandwidth operation.

## Release gate definitions

### Simulator release
- CI passes.
- No known critical/high security defect.
- All outputs clearly labelled as simulated.
- Curriculum and assessment integrity tests pass.
- Accessibility smoke test passes.

### University pilot release
- All Level 1 items in UNIVERSITY_READINESS.md have evidence.
- Institution approves privacy and academic use.
- Identity, instructor, cohort, assignment, moderation, backup, and restore workflows pass.
- Pilot feedback is reviewed and actions tracked.

### Live lab release
- All Level 2 items pass.
- Independent isolation and teardown validation is documented.
- No unresolved critical/high security findings.
- Incident response and operational ownership are established.

### Research release
- All Level 3 items pass.
- Experiment provenance and reproduction procedures are demonstrated.
- Research ethics and data governance are approved where required.

## Evidence discipline

Do not mark a gate complete based only on a plan, screenshot, or passing unit test. Store the exact workflow run, test report, review record, or operational exercise that supports each claim.
