# University Curriculum Map

## Scope and academic caution

This is a proposed curriculum framework for institutions to adapt. It is not an accredited syllabus and does not claim that the current application implements all listed topics.

The undergraduate pathway is designed for BIT / computing students. The postgraduate pathway is designed for MIT-level learners and assumes stronger foundations in computing, networks, software engineering, and research methods. Institutions should map the framework to their own course codes, credit hours, semester structure, and academic regulations.

## Curriculum design principles

- Teach concepts before tools and explain why a command is appropriate.
- Pair offensive-security concepts with defensive controls, authorization, and evidence handling.
- Progress from guided work to independent, unfamiliar scenarios.
- Assess reasoning and evidence rather than command memorization.
- Separate simulated fixtures from live observations.
- Use realistic but fictional targets in the default teaching mode.
- Require authorization and technical isolation for any live lab.
- Include accessibility, ethics, privacy, and professional communication throughout.

## Undergraduate BIT pathway

| Stage | Module | Core topics | Practical evidence |
|---|---|---|---|
| Foundation | Linux and computing environments | Shell model, filesystem, users, permissions, processes, logs | Annotated command transcript and permissions analysis |
| Foundation | Networking fundamentals | TCP/IP, addressing, routing, DNS, HTTP, ports, packet concepts | Network diagram and protocol explanation |
| Foundation | Programming for security | Python, data parsing, regular expressions, APIs, error handling | Small defensive automation script and tests |
| Intermediate | Security principles | CIA, threat modelling, risk, identity, access control, cryptography basics | Threat model and control mapping |
| Intermediate | Reconnaissance and asset discovery | Scope, passive/active discovery, service identification, false positives | Authorized asset inventory with evidence and limitations |
| Intermediate | Web application security | HTTP, sessions, input handling, access control, common vulnerability classes | Secure code review and remediation report |
| Intermediate | Defensive operations | Logs, alert triage, endpoint/network telemetry, incident lifecycle | Investigation timeline and incident report |
| Advanced | Vulnerability assessment | Validation, severity, exploitability conditions, remediation verification | Prioritized findings report |
| Advanced | Digital forensics | Acquisition principles, hashes, chain of custody, timelines, artifacts | Forensic case notes and evidence manifest |
| Advanced | Secure systems and cloud | IAM, secrets, network boundaries, hardening, container basics | Configuration review and secure deployment plan |
| Capstone | Integrated security project | Scoping, design, implementation, testing, reporting, reflection | Reproducible project, demonstration, and defended report |

## Postgraduate MIT pathway

| Research / advanced module | Core topics | Expected output |
|---|---|---|
| Advanced network and protocol security | Protocol state, segmentation, traffic analysis, encrypted traffic metadata, measurement limits | Reproducible protocol investigation |
| Security architecture and engineering | Trust boundaries, secure design, formal threat models, assurance cases | Architecture review and assurance argument |
| Advanced application security | Complex authorization, supply-chain risk, API security, secure SDLC | Research-grade application assessment |
| Malware and reverse engineering foundations | Static/dynamic analysis concepts, sandbox design, indicators, containment | Safe analysis report using approved samples or fixtures |
| Advanced digital forensics and incident response | Memory/disk evidence, timeline correlation, incident hypotheses, uncertainty | Reproducible forensic investigation |
| Cloud, container and platform security | Isolation, identity boundaries, orchestration, policy, runtime monitoring | Threat-informed platform security evaluation |
| Security measurement and experimentation | Experimental design, controls, sampling, statistical reasoning, reproducibility | Experiment protocol and analysis |
| Privacy, ethics and cyber law | Consent, proportionality, data minimization, responsible disclosure, jurisdiction | Ethics and governance review |
| Research seminar / thesis studio | Literature review, research questions, methods, limitations, peer critique | Defensible proposal, artifact, and thesis-quality report |

## Learning outcome pattern

Each module should define outcomes in measurable terms. Example patterns:
- Explain a protocol or operating-system mechanism and distinguish it from a tool's user interface.
- Interpret supplied evidence and distinguish observation, inference, and hypothesis.
- Construct a bounded test plan that respects authorization and scope.
- Reproduce a result using documented versions, inputs, and environment conditions.
- Evaluate uncertainty, false positives, limitations, and alternative explanations.
- Recommend proportionate controls and define how to verify their effectiveness.
- Communicate findings in a technically accurate report for an identified audience.

## Lab progression

1. Concept walkthrough: explain the mental model and terminology.
2. Worked example: inspect a fully explained, seeded or isolated lab example.
3. Guided practice: perform a task with checkpoints and hints.
4. Evidence exercise: record exact observations and provenance.
5. Independent challenge: solve a new scenario with reduced scaffolding.
6. Assessment: submit a finding, analysis, confidence statement, remediation, and verification plan.
7. Reflection: identify assumptions, mistakes, and follow-up learning.

## Required lab content contract

Every substantial lab must provide:
- Learning outcomes and prerequisites.
- Authorization statement and scope.
- Scenario narrative and target classification (fictional, seeded, or isolated live lab).
- Concepts, relevant standards, and authoritative references.
- Tool/command anatomy, options, expected side effects, and safety notes.
- Worked examples and output-field explanations.
- Evidence collection and provenance requirements.
- False-positive and false-negative considerations.
- Defensive relevance and remediation.
- Common mistakes and troubleshooting.
- Guided and independent exercises.
- Rubric, answer guidance, and remediation resources.
- Accessibility alternatives for terminal-only or time-sensitive activities.
- Version and change history.

## Mapping the existing application

The current three labs are Linux foundations, deep reconnaissance chain, and defensive web observation. Each now has four structured lessons, including a substantial advanced topic, measurable module outcomes, and a multi-hour applied capstone with a supplied fictional case packet, milestones, and a weighted rubric. The Linux project interprets fictional access-incident evidence; the reconnaissance project reconciles fictional, scoped inventory observations; and the web project reviews authorization design using synthetic identities and records.

These are meaningful applied learning units, not a complete BIT or postgraduate MIT pathway. They still require subject-matter educator review, institution-specific learning-outcome mapping, source datasets/answer guidance, and accessibility adaptations. Capstones are course-design drafts; their presence in the product is not institutional approval or empirical validation. New topics should be added with the same full learning cycle and automated integrity checks, rather than presented as implemented based on the broader proposed pathway.
