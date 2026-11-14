import type { LearningLesson } from './learningModules';

export const ADVANCED_LESSONS: Record<string, LearningLesson> = {
  'linux-foundations': {
    id: 'linux-incident-evidence',
    title: 'Process context, permissions, and incident evidence',
    level: 'Advanced',
    estimatedMinutes: 60,
    prerequisites: ['Complete the Linux session and filesystem lessons', 'Understand user/group/other permission bits', 'Know that logs are records produced by particular systems, not a complete account of reality'],
    concepts: [
      { term: 'Process identity is contextual', explanation: 'A process has real and effective user/group identities, supplementary groups, a parent process, an environment, and an execution context. A username printed in one log line does not by itself establish which process performed an action, whether a privilege transition occurred, or which files the process could access at that time. Investigations should identify the source and semantics of each field before drawing conclusions.' },
      { term: 'Permission checks are path-dependent', explanation: 'For a process to open a file, the relevant credentials must satisfy access checks on each directory in the path and on the file itself. Owner/group/other mode bits are only part of the picture: ACLs, mount flags, capabilities, namespaces, mandatory-access-control policy, and time-of-check/time-of-use changes can alter the effective result. A static permission snapshot is evidence about the capture time, not proof of historical access.' },
      { term: 'Authentication events are not session proof', explanation: 'A failed authentication, an accepted credential, a session-open record, and a command audit record represent different stages. Authentication may be mediated by a service, policy, key, or external identity provider. A missing event may reflect retention, configuration, clock, or collection gaps; absence from one log is not proof that an event did not happen.' },
      { term: 'Timelines require clock and provenance discipline', explanation: 'Logs may use different time zones, precision, buffering, and clock sources. Normalize timestamps while retaining the original value and offset, note collection times, and consider clock drift and delayed ingestion. Order is useful, but a one-second timestamp difference from unsynchronized sources rarely proves causality.' },
      { term: 'Evidence integrity and minimization', explanation: 'Record who collected each artifact, from which approved source, when, by what method, and whether it was transformed. Preserve hashes or an equivalent integrity record when the process calls for it. Collect only material needed to answer the incident question; redact credentials, personal data, and unrelated user activity in teaching reports.' }
    ],
    commandAnatomy: [
      { syntax: 'Review a supplied, sanitized journal excerpt and permission snapshot', parts: ['Identify the source host/service and collection interval', 'Record original timestamps, timezone, and event identifiers before normalizing', 'Map each event type to what its producer can actually attest', 'Compare snapshot permissions with the specific path and process context'], safety: 'This is an offline interpretation exercise using fictional records. Do not copy real authentication logs, tokens, or personal data into the simulator; no host files or journal are read.' }
    ],
    workedExample: {
      title: 'Separate an accepted authentication from proven file access',
      command: 'Compare the fictional service, authentication, and file metadata records',
      output: '10:14:02Z auth-gateway: account=analyst result=accepted method=key\n10:14:05Z service-a: session-open account=analyst session=redacted\n10:14:06Z file-snapshot: /srv/reports mode=0750 owner=reporter group=reviewers\n10:14:08Z collector: source=host-a clock_offset=unknown',
      interpretation: ['The authentication source recorded an accepted event for the named account at its stated time.', 'A separate service record reports that a session was opened; the relationship between the records requires correlation evidence.', 'Mode 0750 grants owner full access, group read/search access, and no access to others at the snapshot time, subject to ACLs and other controls.', 'The collector explicitly lacks clock-offset information, which limits fine-grained ordering.'],
      notEstablished: ['The records do not show that the account opened or read the specific file.', 'The permission snapshot does not establish historical permissions or effective ACL/MAC policy.', 'The account label alone does not establish the process credentials or the human behind the activity.', 'All records are fictional fixtures; the simulator did not inspect a Linux host.']
    },
    evidencePractice: [
      { observation: 'The authentication record says result=accepted at 10:14:02Z.', inference: 'That record source reports accepting an authentication attempt for the named account.', hypothesis: 'The accepted identity may have been used to start service-a, but a shared request/session identifier or service-side correlation is needed.' },
      { observation: 'The directory snapshot shows mode 0750, owner reporter, group reviewers.', inference: 'At capture time, traditional mode bits permit owner access and group read/search, while denying others; additional controls may apply.', hypothesis: 'The analyst account may or may not have had effective access depending on group membership, ACLs, namespaces, and the historical state.' },
      { observation: 'The collector records an unknown host clock offset.', inference: 'Events from this source cannot be precisely aligned with another unsynchronized clock from these timestamps alone.', hypothesis: 'A claimed causal sequence may change after time-source and ingestion-latency checks.' }
    ],
    commonMistakes: [
      { mistake: 'Treating an accepted login as proof that a particular file was read.', correction: 'Correlate identity, session, process, and file-access evidence; state which links are missing.' },
      { mistake: 'Reading 0750 as a complete authorization decision.', correction: 'Evaluate every path component and effective credentials, and ask whether ACLs, mount policy, namespaces, or MAC controls apply.' },
      { mistake: 'Sorting timestamps and assuming the resulting order proves causality.', correction: 'Retain source timestamps, normalize with offsets, and document clock uncertainty and event semantics.' },
      { mistake: 'Interpreting missing logs as evidence that an action did not occur.', correction: 'Check logging configuration, retention, collection coverage, buffering, and source health before relying on absence.' }
    ],
    defensiveRelevance: [
      'Use centralized, time-synchronized logging with documented source identity and retention; monitor ingestion gaps as evidence-quality issues.',
      'Keep service accounts narrowly privileged, review supplementary groups and ACLs, and make sensitive file access auditable where proportionate.',
      'Define an incident collection procedure that preserves provenance, minimizes personal data, and separates raw evidence from analyst interpretation.',
      'Use explicit correlation identifiers across authentication and application services without logging secrets or unnecessary personal content.'
    ],
    guidedPractice: [
      { task: 'Annotate each field in the sample records with the system that produced it and the exact claim it supports.', successCriteria: 'You do not promote an account label into proof of a person or a file read.' },
      { task: 'Explain the effective access questions raised by mode 0750 on /srv/reports.', successCriteria: 'You cover path traversal, owner/group identity, supplementary groups, ACLs, and snapshot time.' },
      { task: 'Create a timeline retaining the original timestamp and a normalized UTC column.', successCriteria: 'Unknown offsets and collection gaps remain explicit; event ordering is not described as causality.' },
      { task: 'Draft a least-privilege follow-up request for the service owner.', successCriteria: 'It requests only relevant synthetic/authorized account, policy, and audit evidence and includes a privacy-safe handling note.' }
    ],
    independentChallenge: {
      scenario: 'Two fictional collectors disagree about whether a reviewer account accessed a report: one has an accepted authentication event, another has a file snapshot after the reported time, and neither source documents its clock offset.',
      deliverables: ['A provenance table for all artifacts and collection gaps', 'A timeline that preserves original time values and uncertainty', 'At least three competing explanations with evidence that would distinguish them', 'A bounded owner-side verification request and least-privilege containment option', 'A concise conclusion that distinguishes supported, unsupported, and unknown claims']
    },
    knowledgeCheck: [
      { question: 'Does a mode-0750 snapshot prove a named user read a file?', answer: 'No.', rationale: 'It describes mode bits at capture time. Effective credentials, path permissions, additional controls, historical state, and an access event are separate evidence.' },
      { question: 'Can an accepted authentication event establish that an application operation succeeded?', answer: 'No.', rationale: 'Authentication, session creation, authorization, and application action are separate events with separate evidence sources.' },
      { question: 'What should an analyst do when two logs use clocks with unknown offsets?', answer: 'Preserve source times, record uncertainty, and avoid asserting fine-grained ordering or causality until clocks and ingestion delays are evaluated.', rationale: 'Timestamp ordering is only as reliable as clock and pipeline provenance.' }
    ],
    references: [
      { label: 'Linux man-pages — credentials(7)', url: 'https://man7.org/linux/man-pages/man7/credentials.7.html' },
      { label: 'Linux man-pages — path_resolution(7)', url: 'https://man7.org/linux/man-pages/man7/path_resolution.7.html' },
      { label: 'NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response', url: 'https://csrc.nist.gov/pubs/sp/800/86/final' }
    ]
  },
  'deep-recon-full-chain': {
    id: 'recon-correlation-and-prioritization',
    title: 'Correlating inventory evidence and managing uncertainty',
    level: 'Advanced',
    estimatedMinutes: 65,
    prerequisites: ['Complete scope and networking lessons', 'Understand DNS caching and TCP/UDP scan states', 'Be able to distinguish an observation from a vulnerability conclusion'],
    concepts: [
      { term: 'An inventory is a time- and vantage-bound model', explanation: 'An asset inventory is not a timeless list of machines. DNS, cloud addresses, load balancers, dynamic allocation, NAT, and service discovery change what an observer sees. Every record needs provenance: source, time, vantage point, method, scope, and owner validation status.' },
      { term: 'Entity resolution is not string matching', explanation: 'A hostname, IP address, certificate name, banner, and CMDB identifier may refer to the same service—or different layers of a shared platform. Correlation should use multiple independent attributes and retain ambiguity. A cloud or shared-hosting address may contain unrelated tenants; its address alone does not establish ownership or authorization.' },
      { term: 'Negative observations have coverage limits', explanation: 'A scan that reports no service only establishes that the method did not observe a response from its vantage point under those conditions. Filtering, route asymmetry, rate limits, packet loss, IPv4/IPv6 differences, and service policy may explain silence. Record the test coverage rather than turning non-observation into a claim of absence.' },
      { term: 'Confidence and severity are different dimensions', explanation: 'Confidence describes how strongly evidence supports a claim; severity estimates the consequence if a condition is real and exploitable. A severe hypothetical with weak evidence may need quick owner verification, not a definitive vulnerability label. State confidence and impact separately, then prioritize using exposure, asset importance, preconditions, compensating controls, and verification cost.' },
      { term: 'Reproducibility requires preserving the collection recipe', explanation: 'A defensible inventory records authorization version, scope, collection window, tool/version, options, source vantage, resolver, timestamps, and raw result references. Re-running at another time or location is a new observation, not an edit to the old one.' }
    ],
    commandAnatomy: [
      { syntax: 'Reconcile supplied DNS, inventory, and scan records; do not broaden the target set', parts: ['Keep each source row immutable and assign a stable evidence ID', 'Normalize hostnames, addresses, ports, protocols, timestamps, and vantage in derived fields', 'Record candidate entity links with a rationale and confidence rather than silently merging', 'Flag out-of-scope or unowned assets for authorization review instead of probing them'], safety: 'This is a data-analysis exercise on fictional records. The course does not issue scans, enumerate real assets, or authorize testing of discovered third parties.' }
    ],
    workedExample: {
      title: 'Resolve a conflicting service record without overclaiming',
      command: 'Compare the three fictional observations and their collection metadata',
      output: '09:00Z resolver-A: portal.example.test A 192.0.2.20 TTL=60\n09:10Z inventory: owner=Student Services endpoint=portal.example.test state=managed\n09:12Z scanner-vantage-1: 192.0.2.20:443/tcp open; banner=proxy sample\n09:14Z resolver-B: portal.example.test A 192.0.2.21 TTL=60',
      interpretation: ['The two resolvers returned different addresses at different times; short TTL and timing make cache or intentional traffic distribution plausible.', 'The scanner observed a TCP/443 response at one address from one vantage point.', 'The inventory assigns an owner to a hostname, not necessarily every address that resolved for it.', 'The banner is a proxy fingerprint and may describe an edge layer rather than the application host.'],
      notEstablished: ['The observations do not prove that either address is misconfigured or vulnerable.', 'They do not establish that both IP addresses belong exclusively to the institution.', 'A single vantage cannot establish global reachability or absence.', 'The simulator did not query DNS or send packets; the dataset is illustrative.']
    },
    evidencePractice: [
      { observation: 'Resolver-A returned 192.0.2.20 at 09:00Z; resolver-B returned 192.0.2.21 at 09:14Z.', inference: 'The name had different answers at the recorded resolver/time combinations.', hypothesis: 'Caching, geo-distribution, split-horizon policy, a change, or inconsistent data could explain the difference; resolver and authoritative-owner records are needed.' },
      { observation: 'One scanner vantage observed TCP/443 and a proxy-like banner on 192.0.2.20.', inference: 'That vantage received a response classified as an open TCP service and a banner matching the sample fingerprint.', hypothesis: 'The endpoint could be a shared edge service; owner-side routing/configuration records would clarify service ownership.' },
      { observation: 'The owner register lists portal.example.test but no address ownership mapping.', inference: 'The institution identifies responsibility for the name but has not supplied address-level attribution in this fixture.', hypothesis: 'Testing the second address may cross an authorization boundary until the service owner confirms it is in scope.' }
    ],
    commonMistakes: [
      { mistake: 'Merging every IP observed for a hostname into one owned asset.', correction: 'Preserve time and resolver context, and obtain an owner-confirmed mapping before treating addresses as authorized targets.' },
      { mistake: 'Reporting a service as absent because one scan returned no response.', correction: 'Describe the non-observation with vantage, method, time, and coverage; consider filtering and route differences.' },
      { mistake: 'Combining confidence and impact into one severity label.', correction: 'State evidence confidence separately from potential impact and explain what validation changes the decision.' },
      { mistake: 'Editing old inventory rows after a re-scan.', correction: 'Keep observations immutable and create a new time-stamped record with its collection recipe.' }
    ],
    defensiveRelevance: [
      'Reconcile external observations with cloud inventory, DNS change records, service ownership, and network telemetry before assigning remediation.',
      'Treat unknown ownership as a governance issue: route it to the asset owner and do not probe it while authorization is unresolved.',
      'Use repeated, comparable observations to detect change, while preserving collection differences so false trends are not created.',
      'Prioritize controls and owner verification based on business context; a public banner is neither a vulnerability proof nor a complete risk model.'
    ],
    guidedPractice: [
      { task: 'Create an evidence ledger for the worked example with immutable source fields and normalized derived fields.', successCriteria: 'Every row includes time, vantage, source/method, scope status, and exact observation.' },
      { task: 'Draw two plausible asset-resolution models that explain both DNS answers.', successCriteria: 'Each model is labelled as a hypothesis and includes evidence that would discriminate it.' },
      { task: 'Write separate confidence and potential-impact statements for the proxy observation.', successCriteria: 'You do not call the banner vulnerable or the endpoint institution-owned without corroboration.' },
      { task: 'Design the minimum owner-approved verification step.', successCriteria: 'It resolves address/edge ownership before any additional active collection and includes a stop condition.' }
    ],
    independentChallenge: {
      scenario: 'A fictional inventory contains a stale CMDB row, a DNS answer from an internal resolver, a different public-resolver answer, and a scan result from a VPN egress point. A service owner says the hostname was migrated last week but has not supplied a change record.',
      deliverables: ['An immutable observation ledger with provenance and scope status', 'At least two competing entity-resolution models', 'A confidence statement and impact statement for each candidate finding', 'A prioritized, least-intrusive verification request with owner and success criterion', 'A reproducibility note specifying what would make a future comparison valid']
    },
    knowledgeCheck: [
      { question: 'What does a scan that receives no response establish?', answer: 'Only that the selected method did not observe a response from that vantage under those conditions.', rationale: 'Filtering, loss, asymmetry, and service behavior can all affect silence.' },
      { question: 'Does a hostname resolving to an address make that address authorized for testing?', answer: 'No.', rationale: 'Technical resolution is not ownership evidence or authorization.' },
      { question: 'Why report confidence separately from potential impact?', answer: 'Because evidence strength and consequence are distinct; a high-impact hypothesis can still have weak evidence.', rationale: 'Separating them makes verification priority and uncertainty explicit.' }
    ],
    references: [
      { label: 'NIST SP 800-115 — Technical Guide to Information Security Testing', url: 'https://csrc.nist.gov/pubs/sp/800/115/final' },
      { label: 'RFC 1034 — Domain Names: Concepts and Facilities', url: 'https://www.rfc-editor.org/rfc/rfc1034' },
      { label: 'FIRST CVSS v4.0 Specification', url: 'https://www.first.org/cvss/v4.0/specification-document' }
    ]
  },
  'defensive-web-observation': {
    id: 'web-authorization-design-review',
    title: 'Authorization design, trust boundaries, and regression evidence',
    level: 'Advanced',
    estimatedMinutes: 70,
    prerequisites: ['Complete the HTTP and session lessons', 'Understand object-level authorization and multi-tenant data boundaries', 'Be able to write positive and negative test cases'],
    concepts: [
      { term: 'Authorization is a decision over principal, action, and object', explanation: 'A robust policy evaluates who is acting, what action is requested, which exact object is involved, and the relevant tenant or relationship context. A role label alone may be too coarse: a lecturer may manage one assigned cohort but not another, and a student may access only their own permitted submission. Policy must be enforced at the server boundary on every operation.' },
      { term: 'Trust boundaries exist between layers', explanation: 'Browser controls, route handlers, service methods, and database policies each protect different boundaries. Hiding a control in the UI is usability, not authorization. A handler can authenticate a session yet still fail to authorize an object. A database row-level policy can limit tenant rows yet cannot decide every application-specific action or cohort relationship.' },
      { term: 'Negative cases define security behavior', explanation: 'Tests should specify expected denial for unauthenticated callers, wrong roles, wrong tenant, non-owner, inactive membership, and invalid state transitions. Tests must inspect returned data and side effects—not only status codes. Use disposable synthetic records and verify that denied writes leave no partial state.' },
      { term: 'Non-disclosure and observability must be balanced', explanation: 'A service may return a consistent not-found response to avoid confirming another tenant’s object, while recording a privacy-safe authorization decision internally. Avoid logging tokens, submitted secrets, or full sensitive records. Correlation IDs and stable reason categories can support operations without exposing the protected object.' },
      { term: 'A security fix needs a regression argument', explanation: 'A complete fix states the invariant, its enforcement point, and how both permitted and forbidden behavior are tested. Add regression cases at the API/service boundary and, where useful, database policy level. Repeat tests after role, tenant, ownership, lifecycle, and export behavior changes.' }
    ],
    commandAnatomy: [
      { syntax: 'Review a synthetic route contract and authorization matrix', parts: ['Identify the server-derived principal and tenant context', 'Name the object owner, assigned cohort, action, and lifecycle preconditions', 'Specify allowed and denied outcomes for each synthetic identity', 'Check response body and database side effects for every case'], safety: 'Use only course fixtures and synthetic identities. The simulator makes no HTTP requests and must never be used to test a real account or service.' }
    ],
    workedExample: {
      title: 'Test a tenant-scoped submission export policy',
      command: 'Evaluate the fictional policy for student, assigned lecturer, unassigned lecturer, and another-tenant admin',
      output: 'Policy: a student may read their own submission; an assigned lecturer may review submissions in the assigned cohort; institution admins may administer their institution; platform operators have no default access to learner content.\nFixture: submission S belongs to student U1, cohort C1, institution T1.\nExpected: U1=allow read; U2 in T1=deny; lecturer L1 assigned to C1=allow review; lecturer L2 not assigned to C1=deny; admin T2=deny.',
      interpretation: ['The policy describes principal, action, ownership, cohort assignment, and tenant as separate decision inputs.', 'The matrix contains both expected allow and deny cases, so a blanket deny cannot falsely pass as secure.', 'The platform-operator constraint demonstrates that administrative role names do not automatically imply access to academic content.'],
      notEstablished: ['The policy text does not prove that a real route implements the invariant.', 'A denied HTTP status alone does not prove no submission data or write side effect leaked.', 'The fixture is fictional and does not authorize requests against a real portal.']
    },
    evidencePractice: [
      { observation: 'Student U1 owns S in tenant T1 and receives the expected read decision in the fixture.', inference: 'The policy intends owner access for this operation.', hypothesis: 'The route may still leak fields or allow a different operation unless read, update, and export are tested independently.' },
      { observation: 'Lecturer L2 is in T1 but is not assigned to cohort C1 and is expected to be denied.', inference: 'Institution membership alone is insufficient for lecturer access to this cohort’s submission.', hypothesis: 'A route that checks only the lecturer role could omit the cohort-assignment authorization condition.' },
      { observation: 'Admin T2 belongs to another institution and is expected to be denied.', inference: 'Tenant boundary takes precedence over the administrator’s role in T2.', hypothesis: 'A query or export that omits tenant context could violate the intended policy; synthetic cross-tenant tests can check this.' }
    ],
    commonMistakes: [
      { mistake: 'Treating authentication or an institution role as sufficient authorization for every object.', correction: 'Check principal, action, tenant, ownership/assignment, and resource state at the server boundary.' },
      { mistake: 'Testing only a successful owner request.', correction: 'Include wrong-owner, wrong-cohort, wrong-tenant, inactive-membership, and invalid-state cases.' },
      { mistake: 'Asserting security from a 403/404 response alone.', correction: 'Check response content, secondary effects, database state, exports, and privacy-safe audit evidence.' },
      { mistake: 'Giving platform or support operators broad academic-data access by default.', correction: 'Separate operational administration from academic-content permissions and audit any exceptional access.' }
    ],
    defensiveRelevance: [
      'Centralize policy checks or use narrowly scoped service operations so that routes do not implement inconsistent access rules.',
      'Derive tenant identity from a verified server session, then recheck membership and resource relationships within the protected operation.',
      'Use synthetic multi-tenant tests to verify read, create, update, delete, grade, appeal, and export boundaries.',
      'Document exceptional support access, require a reason and approval, limit its duration, and audit it without copying learner content into logs.'
    ],
    guidedPractice: [
      { task: 'Extend the worked policy matrix to create, update, and export operations.', successCriteria: 'Each operation has an explicit principal, tenant, ownership/assignment, lifecycle condition, and expected outcome.' },
      { task: 'Write a test precondition for each denied case and state which side effects must remain absent.', successCriteria: 'Tests use synthetic records and inspect both response data and persistent state.' },
      { task: 'Trace where tenant and cohort context should be obtained and enforced in a layered application.', successCriteria: 'The browser is not authoritative; server and database controls have clearly distinct responsibilities.' },
      { task: 'Define a privacy-safe audit event for a denied cross-tenant attempt.', successCriteria: 'The record supports investigation without logging tokens, submission bodies, or unnecessary personal data.' }
    ],
    independentChallenge: {
      scenario: 'A fictional assignment API checks that a caller is a lecturer, then accepts a submission ID from the request path. The institution has two cohorts, multiple lecturers, student-owned submissions, and an administrator role. No implementation evidence is supplied.',
      deliverables: ['A trust-boundary diagram and explicit authorization invariant', 'A role × tenant × cohort × ownership × operation test matrix', 'A prioritized set of synthetic negative cases and expected side-effect checks', 'A defense-in-depth remediation sketch and regression strategy', 'A limitations statement that does not label the fictional route vulnerable without evidence']
    },
    knowledgeCheck: [
      { question: 'Is a lecturer role alone sufficient to authorize access to any submission in the institution?', answer: 'No.', rationale: 'The policy may also require assigned-cohort membership, object ownership, operation permission, and valid resource state.' },
      { question: 'What should a negative authorization test verify beyond an error response?', answer: 'That protected data was not returned and no forbidden persistent side effect occurred.', rationale: 'Status codes alone do not prove data confidentiality or integrity.' },
      { question: 'Why test both an allowed owner request and a denied non-owner request?', answer: 'To prove the policy is enforced without making the feature unusable through blanket denial.', rationale: 'Security correctness includes the intended positive path and forbidden paths.' }
    ],
    references: [
      { label: 'OWASP Authorization Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html' },
      { label: 'OWASP API Security Top 10 — Broken Object Level Authorization', url: 'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/' },
      { label: 'NIST SP 800-162 — Guide to Attribute Based Access Control', url: 'https://csrc.nist.gov/pubs/sp/800/162/upd2/final' }
    ]
  }
};
