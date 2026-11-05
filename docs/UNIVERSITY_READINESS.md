# University Readiness and Adoption Standard

## Purpose

This document defines the evidence required before CyberSandbox can be adopted as a university teaching platform. It is a product-readiness standard, not a claim of accreditation, institutional approval, or current production readiness.

CyberSandbox now contains a simulated browser lab, a university portal UI, a Node.js/PostgreSQL API implementation, institution-scoped academic schemas and initial workflows. The API is not deployed and no institution is provisioned. Live Kali infrastructure and research compute are not connected. The repository is therefore still below Level 1 for institutional adoption.

## Intended users and learning modes

- Undergraduate BIT / computing students: progressive foundations, guided practice, practical reasoning, safe security operations, and structured reporting.
- Postgraduate MIT / advanced computing students: deeper protocol and system analysis, independent investigations, research methods, reproducible experiments, critical evaluation, and defensible technical writing.
- Lecturers and lab instructors: course configuration, cohort management, assignment design, feedback, moderation, and evidence-based learning analytics.
- Lab administrators: approved images, isolation policies, resource quotas, monitoring, incident response, and lifecycle management.

The exact course mapping must be approved by each adopting institution. MIT is treated here as a postgraduate-level pathway, not as a claim about any specific university's degree structure.

## Readiness levels

### Level 0 — Demonstration simulator (current baseline)

Permitted:
- Classroom demonstrations using seeded outputs.
- Self-paced concept reading and formative knowledge checks.
- Practice distinguishing observation, inference, hypothesis, and unsupported claims.

Not permitted:
- Claims of live Kali command execution.
- Formal grades, certification, hiring decisions, or disciplinary decisions based on heuristic scores.
- Claims that local browser storage progress is verified student evidence.
- Real-target scanning or exploitation.

### Level 1 — Pilot-ready learning application

Required:
- Institution-approved course and learning-outcome mapping.
- Accessibility review against WCAG 2.2 AA targets.
- Cross-browser and mobile testing, including low-bandwidth operation.
- Versioned curriculum, rubrics, fixtures, and answer keys.
- Educator review of every lesson and practical exercise.
- Privacy notice, data-retention policy, acceptable-use policy, and incident contact.
- Authenticated learner and instructor identities.
- Server-side, tenant-isolated progress and assignment records.
- Human moderation and appeals for any assessed submission.
- Backup, restore, audit, and operational monitoring.
- A documented pilot with lecturer and student feedback.

### Level 2 — University lab-ready

All Level 1 requirements plus:
- Disposable, isolated lab execution with deny-by-default networking.
- Per-session authorization, quotas, timeouts, resource limits, and automatic teardown.
- Server-side event and assessment records with provenance.
- Instructor-managed cohorts, assignments, deadlines, feedback, and exports.
- Independent security testing and a documented threat-model review.
- Reproducible lab images, pinned versions, and tested reset procedures.
- Operational runbooks, incident response, recovery objectives, and support ownership.
- Evidence that lab isolation and teardown work under adversarial and failure conditions.

### Level 3 — Research-capable platform

All Level 2 requirements plus:
- Experiment definitions with immutable versions and provenance.
- Reproducible seeds, environment manifests, tool versions, and dataset lineage.
- Exportable, privacy-reviewed research records.
- Repeatable experiment execution and independent reproduction procedures.
- Research ethics, consent, data governance, and publication review where applicable.
- Clear separation between teaching environments, research environments, and production systems.

## Non-negotiable safety requirements

1. Never execute arbitrary learner input on the application host.
2. Never expose container runtime credentials, cloud credentials, or provider secrets to the browser.
3. Never mount host filesystems, Docker sockets, or sensitive host paths into student labs.
4. Deny outbound traffic by default; permit only explicitly approved lab destinations.
5. Require explicit authorization for every live target and enforce scope technically.
6. Apply CPU, memory, process, disk, bandwidth, and wall-clock limits.
7. Destroy lab resources after expiry and verify teardown.
8. Log security-relevant lifecycle events without collecting unnecessary sensitive content.
9. Treat browser state and client-submitted completion claims as untrusted.
10. Provide a safe shutdown and incident-response path.

## Academic quality requirements

Every assessed learning outcome must have:
- A clear verb and observable performance standard.
- Prerequisite knowledge and learning materials.
- A practical task aligned to the outcome.
- A rubric with observable criteria and performance levels.
- A feedback and remediation path.
- A documented method for educator moderation.
- A versioned mapping to the relevant course/module.

Course alignment must be reviewed by qualified educators. This project must not claim equivalence to MIT, BIT, or any university syllabus without that review.

## Assessment governance

The current local heuristic scorer is formative only. Before any score contributes to a formal grade:
- Create a diverse, anonymized submission dataset.
- Obtain independent ratings from at least two qualified reviewers.
- Measure agreement and error patterns by dimension and learner level.
- Test adversarial, concise, verbose, multilingual, typo-heavy, and technically incorrect submissions.
- Publish known limitations and keep human review for disputed or consequential outcomes.
- Version the rubric, evaluator, and scoring configuration.
- Preserve an audit trail for score changes and moderation.

A deterministic heuristic must never be represented as an expert semantic grader.

## Adoption checklist

- [ ] Course owner and academic approver identified.
- [ ] Course outcomes and syllabus mapping reviewed.
- [ ] Educator-reviewed content and lab answer keys approved.
- [ ] Accessibility and assistive-technology review completed.
- [ ] Privacy, consent, retention, and acceptable-use documents approved.
- [ ] Learner and instructor access controls tested.
- [ ] Tenant isolation tested.
- [ ] Assignment, feedback, moderation, and export workflows tested.
- [ ] Backup restoration demonstrated.
- [ ] Security review and incident exercise completed.
- [ ] Lab isolation, quotas, teardown, and network policy independently tested.
- [ ] Pilot evaluation report accepted by the institution.

## Current honest status

The repository has a stronger implementation foundation than the original Level 0 simulator: institution login UI, role-specific dashboards, server-side authentication/session code, PostgreSQL tenant isolation policies, academic course/cohort/assignment workflows, moderated grade history, appeals, CSV exports, and research metadata/provenance schemas. CI now provisions PostgreSQL and runs an initial two-institution RLS/role test. However, the API is not deployed, there is no provisioned institution, invitation/recovery/MFA/SSO and full account lifecycle are missing, PostgreSQL tests do not yet cover every API route or the exact production database role, and there is no live Kali worker, research compute, artifact storage, accessibility audit, academic content approval, backup/restore evidence or independent security review. It does not yet meet Level 1, Level 2 or Level 3.
