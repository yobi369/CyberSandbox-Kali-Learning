# Instructor and Learning Management Specification

## Purpose

Define the minimum academic workflows required to move CyberSandbox from a single-browser simulator to a university learning application. These are product requirements, not implemented features.

## Roles

- Platform administrator: manages service configuration and platform-level operations.
- Institution administrator: manages an institution tenant, memberships, retention settings, and institutional configuration.
- Lecturer / instructor: manages assigned courses, cohorts, learning activities, assignments, rubrics, feedback, and moderation.
- Teaching assistant: supports assigned cohorts and reviews work within delegated permissions.
- Learner: accesses enrolled courses, runs authorized labs, submits work, and views feedback.
- Lab operator: manages lab images, worker health, policy profiles, and session lifecycle without automatically receiving access to academic grades.

Use least privilege. Roles should be permission bundles, not a substitute for checking resource ownership and cohort assignment.

## Learner workflows

1. Sign in and view enrolled courses.
2. Open a versioned module and review outcomes, prerequisites, and learning resources.
3. Complete guided exercises and formative knowledge checks.
4. Request a lab session when the activity permits it.
5. View session mode, scope, expiry, and resource limits before launch.
6. Collect evidence and write a technical finding.
7. Submit an assignment with the required evidence and references.
8. View rubric feedback, lecturer comments, moderation status, and remediation.
9. Appeal or request clarification through a documented workflow.
10. Export the learner's own permitted work and progress.

## Instructor workflows

1. Create or select an institution-approved course version.
2. Create cohorts and enroll learners or import an approved roster.
3. Assign lessons, exercises, labs, and deadlines.
4. Select or adapt a versioned rubric.
5. Review submissions with evidence and provenance visible.
6. Provide criterion-level feedback and remediation.
7. Moderate automated feedback and correct it with a reason.
8. Reopen or extend work under an auditable policy.
9. Review cohort progress and identify learning gaps.
10. Export approved academic records.

## Assessment rules

- Formative practice must be visibly distinct from graded work.
- Machine-generated feedback must be labelled and traceable to the evaluator version.
- Human moderation must be available for graded or disputed work.
- Rubric versions must be immutable once used for a submission.
- Regrading must create a new assessment event rather than silently overwrite history.
- Learners must see criteria, weighting, and appeal instructions before submission.
- Academic misconduct detection must not rely on an opaque score alone.
- Do not infer student ability from XP, time-on-task, or command count alone.

## Minimum data contract

All entities require stable IDs, created/updated timestamps, and explicit lifecycle state.

| Entity | Required relationships / fields |
|---|---|
| Organization | name, status, policy settings |
| User | identity subject, display name, status |
| Membership | organization, user, role, permissions, status |
| Course | organization, title, owner |
| CourseVersion | course, version, outcomes, publication status |
| Cohort | course version, instructor assignments, term |
| Enrollment | cohort, learner, status |
| LabDefinition | version, learning outcomes, target mode, policy profile |
| Assignment | cohort, lab/content version, rubric version, due date |
| Submission | assignment, learner, content, artifact references, status |
| Assessment | submission, rubric version, evaluator version, dimension scores |
| Moderation | assessment, reviewer, decision, rationale, timestamp |
| AuditEvent | actor, organization, action, resource, result, correlation ID |

## Privacy and data governance

- Collect only data required for learning, safety, support, and institutional obligations.
- Explain what terminal input, lab telemetry, submissions, and artifacts are collected.
- Define retention and deletion schedules with each institution.
- Restrict instructor access to assigned cohorts.
- Do not expose one institution's learners, submissions, or lab sessions to another tenant.
- Provide export and correction processes consistent with institutional policy and applicable law.
- Separate operational logs from academic records.
- Avoid collecting passwords, personal secrets, or unrelated host data from student devices.

## Accessibility and inclusion

Target WCAG 2.2 AA. Include full keyboard navigation and visible focus; semantic headings, labels, and landmarks; screen-reader announcements for terminal output and assessment feedback; sufficient contrast and no color-only status indicators; zoom/reflow and small-screen layouts; reduced-motion support; captions or transcripts for audio/video instruction; alternatives for tasks that rely on color, timing, drag-and-drop, or terminal-only interaction; and clear, plain-language error messages.

## Pilot acceptance criteria

A pilot is not accepted until a lecturer and representative learners can complete enrollment and course access; lesson navigation and accessible knowledge checks; assignment creation and submission; rubric feedback and moderation; progress reporting and export; account recovery and access revocation; backup restoration and support escalation.

For any live lab pilot, also verify isolation, quotas, teardown, policy enforcement, and incident handling independently.
