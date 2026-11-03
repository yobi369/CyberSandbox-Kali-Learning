import type { Lab } from '../types';

export interface WorkedExample {
  title: string;
  command: string;
  output: string;
  interpretation: string[];
  notEstablished: string[];
}

export interface LearningLesson {
  id: string;
  title: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedMinutes: number;
  prerequisites: string[];
  concepts: { term: string; explanation: string }[];
  commandAnatomy: { syntax: string; parts: string[]; safety: string }[];
  workedExample: WorkedExample;
  evidencePractice: { observation: string; inference: string; hypothesis: string }[];
  commonMistakes: { mistake: string; correction: string }[];
  defensiveRelevance: string[];
  guidedPractice: { task: string; successCriteria: string }[];
  independentChallenge: { scenario: string; deliverables: string[] };
  knowledgeCheck: { question: string; answer: string; rationale: string }[];
  references: { label: string; url: string }[];
}

export interface LearningModule {
  labId: Lab['id'];
  overview: string;
  learningPath: string[];
  lessons: LearningLesson[];
}

const linux: LearningModule = {
  labId: 'linux-foundations',
  overview: 'Build a dependable mental model of a Linux command-line session. The terminal in this product is a browser simulation: commands return seeded examples and do not invoke the host shell.',
  learningPath: ['Orient yourself before acting', 'Inspect files and reason about paths', 'Understand DNS as a distributed naming system', 'Write a careful evidence note'],
  lessons: [
    {
      id: 'linux-session-model', title: 'The shell, process, and session model', level: 'Beginner', estimatedMinutes: 20,
      prerequisites: ['No Linux experience required', 'Know the difference between an application and an operating system'],
      concepts: [
        { term: 'Operating system', explanation: 'The OS coordinates hardware, memory, processes, users, files, and devices. A terminal emulator is an application that displays text; a shell is a program that interprets commands. They are related but not interchangeable.' },
        { term: 'Shell command lifecycle', explanation: 'A shell parses a command line into a program name, options, and arguments; resolves the executable; starts a process; and displays its output and exit status. In a real Linux system, permissions and environment variables affect what happens. This training console imitates selected responses rather than running that lifecycle.' },
        { term: 'Identity and least privilege', explanation: 'whoami reports the effective user identity of a real process. Identity influences access checks. Prefer a normal account and narrowly scoped privilege; do not use root merely to make an error disappear.' },
        { term: 'Working directory', explanation: 'pwd reports the current working directory. Relative paths are interpreted from it; absolute paths begin at /. Knowing the working directory prevents accidental reads or writes in the wrong location.' }
      ],
      commandAnatomy: [
        { syntax: 'whoami', parts: ['Program: whoami', 'No required arguments', 'Output: effective username'], safety: 'Read-only in a real shell. Here the displayed identity is a fixed training value.' },
        { syntax: 'pwd', parts: ['Program: pwd', 'No required arguments', 'Output: current directory path'], safety: 'Read-only. A simulated path is not a claim about the learner’s computer.' }
      ],
      workedExample: { title: 'Establish session context', command: 'whoami && pwd', output: 'kali\n/home/kali', interpretation: ['The first line identifies the training identity.', 'The second line identifies the simulated working directory.', 'The && operator in a real shell runs the second command only if the first exits successfully.'], notEstablished: ['This does not identify the account logged into the learner’s operating system.', 'It does not show whether the real account has sudo privileges.', 'The browser simulator does not start shell processes.'] },
      evidencePractice: [
        { observation: 'The training console printed “kali”.', inference: 'The simulated exercise context is configured with a user named kali.', hypothesis: 'A real machine might also have an account with that name, but this output provides no evidence about it.' },
        { observation: 'The console printed “/home/kali”.', inference: 'The simulated current directory is /home/kali.', hypothesis: 'A real environment may use a different home path or user.' }
      ],
      commonMistakes: [
        { mistake: 'Assuming a terminal window is itself the shell.', correction: 'Distinguish terminal emulator, shell, process, and operating system.' },
        { mistake: 'Treating a relative path as if it starts at the filesystem root.', correction: 'Check pwd and resolve the path from the current directory.' },
        { mistake: 'Using sudo as a routine fix.', correction: 'Understand the permission failure first and request only the minimum required access.' }
      ],
      defensiveRelevance: ['Incident responders record the account and execution context before interpreting artifacts.', 'Least privilege limits damage from mistakes and compromised processes.', 'Accurate paths make evidence collection repeatable.'],
      guidedPractice: [
        { task: 'Run whoami in the simulator and record the exact output.', successCriteria: 'Your note labels it as the training identity, not your host identity.' },
        { task: 'Run pwd, then explain how a relative path would be resolved.', successCriteria: 'You correctly distinguish an absolute path from a path relative to the working directory.' }
      ],
      independentChallenge: { scenario: 'A colleague sends a screenshot showing a command run from /var/tmp and asks whether it proves the command ran as root.', deliverables: ['State what the path establishes.', 'State what the path does not establish about identity or privilege.', 'List the additional authorized evidence you would request.'] },
      knowledgeCheck: [
        { question: 'Does pwd tell you which user is running the shell?', answer: 'No.', rationale: 'pwd reports the current working directory; whoami reports the effective username.' },
        { question: 'Does this simulator’s whoami output inspect your computer?', answer: 'No.', rationale: 'It returns seeded training output and does not access the host operating system.' }
      ],
      references: [{ label: 'GNU Bash Reference Manual', url: 'https://www.gnu.org/software/bash/manual/' }, { label: 'Linux man-pages project', url: 'https://www.kernel.org/doc/man-pages/' }]
    },
    {
      id: 'linux-filesystem', title: 'Filesystem navigation, inspection, and permissions', level: 'Beginner', estimatedMinutes: 25,
      prerequisites: ['Complete The shell, process, and session model', 'Understand absolute and relative paths'],
      concepts: [
        { term: 'Filesystem hierarchy', explanation: 'Linux presents files and directories in one tree rooted at /. /home commonly contains user data, /etc system configuration, /var changing application data and logs, and /tmp temporary files. These are conventions; containers and distributions may differ.' },
        { term: 'Directory entries and metadata', explanation: 'ls lists directory entries. Detailed modes (often requested with ls -l) show file type, permission bits, link count, owner, group, size, and modification time. A filename alone does not reveal content or trustworthiness.' },
        { term: 'Reading files', explanation: 'cat writes file content to standard output and is useful for short text files. For large logs, a pager or bounded selection is safer. Treat untrusted file content as data, not as instructions to execute.' },
        { term: 'Permission model', explanation: 'Traditional Unix permissions define read, write, and execute bits for owner, group, and others. Directory execute permission means search/traverse; directory read permission allows listing names. ACLs, capabilities, mounts, and mandatory access controls can add complexity.' }
      ],
      commandAnatomy: [
        { syntax: 'ls -la /path', parts: ['-l requests a long listing', '-a includes dot-prefixed entries', '/path selects the directory'], safety: 'Read-only. Hidden does not mean secret or protected.' },
        { syntax: 'cat notes.txt', parts: ['cat reads file content', 'notes.txt is resolved relative to pwd unless absolute'], safety: 'Read-only, but avoid dumping secrets or huge files into shared terminals and logs.' }
      ],
      workedExample: { title: 'Inspect the supplied exercise note', command: 'pwd; ls -la; cat notes.txt', output: '/home/kali\n.  ..  notes.txt  robots.txt\nPhase 1: Review the documentation-range training target.', interpretation: ['pwd establishes the current simulated directory.', 'ls shows the names available in the exercise workspace.', 'cat displays the note content; it is supplied training data.'], notEstablished: ['A file existing does not mean its contents are accurate.', 'A robots.txt path is not an authorization boundary.', 'This output does not inspect files on the learner’s device.'] },
      evidencePractice: [
        { observation: 'notes.txt exists in the exercise listing.', inference: 'The exercise workspace provides a note file to inspect.', hypothesis: 'The note may contain target scope or scenario assumptions; read it before relying on it.' },
        { observation: 'robots.txt contains Disallow: /admin/.', inference: 'The sample asks compliant crawlers not to request that path.', hypothesis: 'The path may contain sensitive functionality, but robots.txt neither proves it exists nor protects it.' }
      ],
      commonMistakes: [
        { mistake: 'Treating a hidden dotfile as encrypted or access-controlled.', correction: 'Hidden naming is a display convention, not a security control.' },
        { mistake: 'Assuming directory execute permission means a file can be executed.', correction: 'Directory traversal and file execution are separate permission checks.' },
        { mistake: 'Copying sensitive output into an issue or report without redaction.', correction: 'Minimize collected data and redact credentials, tokens, and personal information.' }
      ],
      defensiveRelevance: ['Review ownership and write permissions on configuration and executable paths.', 'Protect logs and backups against unauthorized reading and modification.', 'Use file integrity monitoring for high-value configuration and binaries.'],
      guidedPractice: [
        { task: 'List the exercise files and identify which are notes versus crawler guidance.', successCriteria: 'You distinguish filenames from conclusions about their contents.' },
        { task: 'Read notes.txt and write one fact plus one uncertainty.', successCriteria: 'The fact is directly supported by text; the uncertainty is not presented as fact.' }
      ],
      independentChallenge: { scenario: 'A web team discovers a robots.txt entry for /admin/ and claims the path is protected.', deliverables: ['Explain what robots.txt does and does not do.', 'Recommend an actual server-side access-control test in an authorized staging environment.', 'Describe what evidence should be captured without collecting real user data.'] },
      knowledgeCheck: [
        { question: 'Does Disallow: /admin/ prevent an attacker from requesting /admin/?', answer: 'No.', rationale: 'robots.txt is crawler guidance, not an authorization mechanism.' },
        { question: 'What does the execute bit on a directory generally allow?', answer: 'Searching or traversing the directory.', rationale: 'Directory permissions differ from executable-file permissions.' }
      ],
      references: [{ label: 'Filesystem Hierarchy Standard', url: 'https://refspecs.linuxfoundation.org/FHS_3.0/fhs/index.html' }, { label: 'GNU Coreutils manual', url: 'https://www.gnu.org/software/coreutils/manual/' }]
    },
    {
      id: 'linux-dns', title: 'DNS resolution and network evidence', level: 'Intermediate', estimatedMinutes: 30,
      prerequisites: ['Understand the command-line session and file inspection', 'Know that IP addresses identify network interfaces or endpoints, not people'],
      concepts: [
        { term: 'DNS hierarchy', explanation: 'DNS is a distributed, hierarchical naming system. A stub resolver typically asks a recursive resolver, which may use cached answers or query authoritative servers by following delegations. Results are governed by record type and TTL.' },
        { term: 'Common record types', explanation: 'A/AAAA map names to IPv4/IPv6 addresses; CNAME aliases a name; MX identifies mail exchangers; NS identifies delegated name servers; TXT carries text data used by multiple protocols. A record’s presence does not prove a host is reachable.' },
        { term: 'Caching and TTL', explanation: 'Resolvers cache answers for their TTL. Different observers can see different answers due to cache age, split-horizon DNS, geo-distribution, or policy. Record a resolver and query time when reproducibility matters.' },
        { term: 'DNS versus service reachability', explanation: 'Name resolution answers a naming question. Routing, firewalls, host state, transport ports, TLS, and application health determine whether a service can actually be reached.' }
      ],
      commandAnatomy: [
        { syntax: 'dig example.test A', parts: ['dig is a DNS query utility', 'example.test is the queried name', 'A requests IPv4 address records'], safety: 'In a real authorized environment this sends a DNS query. In this simulator it returns a fixed example and sends no packets.' },
        { syntax: 'dig @192.0.2.53 example.test MX', parts: ['@192.0.2.53 selects a resolver', 'example.test is the name', 'MX requests mail exchanger records'], safety: 'Use only approved resolvers and in-scope names; documentation-range addresses are examples, not live infrastructure.' }
      ],
      workedExample: { title: 'Interpret an example DNS answer', command: 'dig lab.example.test A', output: 'lab.example.test.  300  IN  A  192.0.2.10', interpretation: ['The owner name is lab.example.test.', '300 is the example TTL in seconds.', 'IN is the Internet DNS class.', 'A is the record type and 192.0.2.10 is the example IPv4 address.'], notEstablished: ['The output does not prove the address is assigned or reachable.', 'It does not identify the server operator or physical location.', 'This simulator did not contact a resolver; the answer is seeded.'] },
      evidencePractice: [
        { observation: 'The seeded answer contains an A record with 192.0.2.10 and TTL 300.', inference: 'The exercise dataset associates that name with that documentation-range IPv4 address for the sample TTL.', hypothesis: 'A real deployment could use split-horizon or different records; confirm from the approved resolver.' },
        { observation: 'A name resolves successfully.', inference: 'The queried resolver returned a matching DNS answer.', hypothesis: 'An application may still be unavailable because DNS is only one dependency.' }
      ],
      commonMistakes: [
        { mistake: 'Calling a successful DNS answer proof that a web server is online.', correction: 'Test service reachability separately and only within approved scope.' },
        { mistake: 'Ignoring resolver identity, query type, and TTL in a report.', correction: 'Record the exact query, resolver, timestamp, answer, and relevant TTL.' },
        { mistake: 'Treating one DNS response as globally authoritative.', correction: 'Consider caching, delegation, split-horizon configuration, and authoritative data.' }
      ],
      defensiveRelevance: ['Monitor unexpected DNS changes and suspicious query patterns.', 'Use DNSSEC where appropriate to protect DNS data integrity.', 'Review exposed records for unintended internal naming or sensitive metadata.', 'Correlate DNS telemetry with endpoint and network logs rather than treating it as standalone proof.'],
      guidedPractice: [
        { task: 'Run the seeded dig example and annotate each output field.', successCriteria: 'Your annotation correctly identifies owner, TTL, class, type, and RDATA.' },
        { task: 'Explain why a DNS answer does not establish TCP or HTTPS availability.', successCriteria: 'You name at least two additional dependencies such as routing, firewall policy, port listener, or TLS.' }
      ],
      independentChallenge: { scenario: 'A monitoring alert reports that portal.example.test resolved to a new address for one user but not another.', deliverables: ['List plausible explanations without prematurely declaring compromise.', 'Identify the resolver, record type, TTL, timestamp, and client network evidence to collect.', 'Propose an authorized verification and escalation sequence.'] },
      knowledgeCheck: [
        { question: 'Which record type maps a DNS name to an IPv6 address?', answer: 'AAAA.', rationale: 'A is IPv4; AAAA is IPv6.' },
        { question: 'Does a DNS A record prove that port 443 is open?', answer: 'No.', rationale: 'DNS resolution and transport/application reachability are separate.' }
      ],
      references: [{ label: 'RFC 1034 — Domain Names: Concepts and Facilities', url: 'https://www.rfc-editor.org/rfc/rfc1034' }, { label: 'RFC 1035 — Domain Names: Implementation and Specification', url: 'https://www.rfc-editor.org/rfc/rfc1035' }, { label: 'BIND dig documentation', url: 'https://bind9.readthedocs.io/' }]
    }
  ]
};

const recon: LearningModule = {
  labId: 'deep-recon-full-chain',
  overview: 'Learn to build a defensible asset and service inventory from authorized, scoped observations. All target data and tool output in this browser lab are seeded examples; no packets are sent.',
  learningPath: ['Define authorization and scope', 'Understand addressing, DNS, and TCP/UDP', 'Interpret scan and service fingerprints', 'Evaluate uncertainty and write a prioritized finding'],
  lessons: [
    {
      id: 'recon-scope', title: 'Authorization, scope, and collection planning', level: 'Beginner', estimatedMinutes: 20,
      prerequisites: ['Basic IP address and DNS familiarity', 'Understand observation versus inference'],
      concepts: [
        { term: 'Written authorization', explanation: 'Security testing requires explicit permission from the asset owner or delegated authority. Permission should identify systems, dates, methods, source addresses, rate limits, contacts, data handling, and stop conditions.' },
        { term: 'Scope boundary', explanation: 'A domain name does not automatically authorize every resolved address, third-party service, cloud tenant, or linked host. Scope must be explicit and rechecked when DNS, redirects, or hosting relationships cross boundaries.' },
        { term: 'Passive and active collection', explanation: 'Passive collection uses already available sources without directly probing the target. Active collection sends traffic and can trigger monitoring or affect fragile services. Both require policy review; passive does not automatically mean risk-free or authorized.' },
        { term: 'Collection plan', explanation: 'Define a question for each method, expected evidence, impact, rate, time window, and rollback/stop process. Collect the minimum information needed and protect findings as sensitive data.' }
      ],
      commandAnatomy: [{ syntax: 'nmap -sn 192.0.2.0/28', parts: ['nmap selects the scanner', '-sn disables port scanning and performs host discovery', '192.0.2.0/28 is a sample documentation range'], safety: 'Only run active discovery against an explicitly authorized range. This product does not run Nmap; its output is illustrative.' }],
      workedExample: { title: 'Turn an authorization note into a scope statement', command: 'Review scope.txt before planning any collection', output: 'Approved lab range: 192.0.2.0/28\nWindow: 10:00–11:00 UTC\nMethods: passive DNS review and low-rate inventory scan\nStop contact: security@example.test', interpretation: ['The range, time window, allowed methods, and contact are explicit constraints.', 'The scope file is a fictional training artifact; real authorization must come from the asset owner.', 'A redirect or third-party hostname is not automatically included.'], notEstablished: ['A note in a simulator is not legal authorization.', 'The scope does not authorize exploitation, credential testing, persistence, or denial-of-service.', 'The documentation address range is not a real target.'] },
      evidencePractice: [
        { observation: 'The sample scope lists one /28 network and a one-hour window.', inference: 'The exercise author intends collection to be limited to that range and time.', hypothesis: 'Any additional hostname or address may be out of scope until the owner confirms it.' }
      ],
      commonMistakes: [{ mistake: 'Assuming ownership of a domain means ownership of every resolved service.', correction: 'Validate each asset and third-party dependency against written scope.' }, { mistake: 'Starting scans before agreeing rate limits and stop conditions.', correction: 'Plan operational safety, escalation contacts, and monitoring coordination first.' }],
      defensiveRelevance: ['Asset owners need a current inventory to reduce unknown exposure.', 'A written scope protects users, service availability, and the assessment team.', 'Data minimization reduces the risk of sensitive information being copied into reports.'],
      guidedPractice: [{ task: 'Draft a scope checklist for a fictional internal /28 range.', successCriteria: 'Include owner, CIDR, time window, permitted methods, rate limits, contact, exclusions, and stop conditions.' }, { task: 'Review a proposed scan plan and identify every action that exceeds the stated methods or time window.', successCriteria: 'You identify out-of-scope targets, methods, timing, and the approval needed before proceeding.' }],
      independentChallenge: { scenario: 'A scoped web application redirects to a hosted identity provider on a different domain.', deliverables: ['Explain why the redirect does not expand authorization.', 'List the owner confirmation required before testing the identity provider.', 'Describe how to record the dependency without probing it.'] },
      knowledgeCheck: [{ question: 'Does a public IP address imply permission to scan it?', answer: 'No.', rationale: 'Reachability is not authorization; written scope is required.' }, { question: 'Does a redirect to a third-party identity provider automatically add that provider to scope?', answer: 'No.', rationale: 'Third-party systems require explicit owner authorization and scope confirmation.' }],
      references: [{ label: 'NIST SP 800-115 — Technical Guide to Information Security Testing', url: 'https://csrc.nist.gov/pubs/sp/800/115/final' }, { label: 'OWASP Web Security Testing Guide', url: 'https://owasp.org/www-project-web-security-testing-guide/' }]
    },
    {
      id: 'recon-networking', title: 'TCP/IP, DNS, ports, and service discovery', level: 'Intermediate', estimatedMinutes: 30,
      prerequisites: ['Complete Authorization, scope, and collection planning', 'Basic understanding of IP addresses'],
      concepts: [
        { term: 'IP and subnet', explanation: 'IP addresses identify interfaces within a network context. CIDR notation expresses a prefix length; for example /24 leaves 8 host bits in IPv4. Network boundaries and routing determine where packets can travel.' },
        { term: 'TCP connection', explanation: 'TCP is connection-oriented. A typical handshake uses SYN, SYN-ACK, and ACK. A scanner may infer a port is open, closed, or filtered based on responses or lack of responses; firewalls and packet loss can make the result ambiguous.' },
        { term: 'UDP', explanation: 'UDP is connectionless and has no handshake. An open UDP service may respond at the application layer; no response often means open|filtered rather than definitively closed. ICMP rate limiting affects observations.' },
        { term: 'Service fingerprinting', explanation: 'A port number is a convention, not proof of the running application. Version detection combines probes and responses; banners can be hidden, proxied, stale, or deliberately misleading.' }
      ],
      commandAnatomy: [
        { syntax: 'nmap -sV -p 22,80 192.0.2.10', parts: ['-sV requests service/version detection', '-p selects ports 22 and 80', 'the final argument is the in-scope target'], safety: 'A real scan sends network probes. Use only the approved target, method, and rate; here output is fixed sample data.' },
        { syntax: 'nmap -sU --top-ports 20 192.0.2.10', parts: ['-sU selects UDP scanning', '--top-ports 20 limits the selected common ports', 'the target must remain inside approved scope'], safety: 'UDP scans can be slow and ambiguous; do not broaden scope or increase intensity without approval.' }
      ],
      workedExample: { title: 'Interpret a fictional service inventory', command: 'nmap -sV -p 22,80 192.0.2.10', output: 'PORT   STATE SERVICE VERSION\n22/tcp open  ssh     OpenSSH 8.2 (sample)\n80/tcp open  http    Apache httpd 2.4.41 (sample)', interpretation: ['22/tcp indicates the sample scanner classified TCP port 22 as open and labeled the service ssh.', 'The version string is a fingerprint estimate from the sample dataset, not independently verified package inventory.', '80/tcp indicates the sample web service is reachable from the scanner vantage point in this fictional example.'], notEstablished: ['An open port does not prove a vulnerability.', 'A banner does not prove the exact installed package or patch level.', 'The output does not establish exploitability, data exposure, or compromise.'] },
      evidencePractice: [
        { observation: 'The sample reports 80/tcp open and an Apache 2.4.41 banner.', inference: 'The sample scanner associated a reachable TCP service with HTTP and an Apache version string.', hypothesis: 'The service may warrant patch and configuration review; confirm the package and backported fixes with the owner.' },
        { observation: 'A UDP scan reports open|filtered.', inference: 'The scanner could not distinguish an open service from filtering based on the response.', hypothesis: 'A controlled application-specific check or firewall review may resolve the ambiguity.' }
      ],
      commonMistakes: [{ mistake: 'Equating port 443 with proof of secure HTTPS configuration.', correction: 'Validate TLS protocol, certificate, cipher, hostname, and application behavior separately.' }, { mistake: 'Treating no UDP response as a closed port.', correction: 'Report the uncertainty and use approved corroborating evidence.' }, { mistake: 'Assuming a version banner reflects installed patch state.', correction: 'Confirm with authenticated package inventory and vendor advisory context.' }],
      defensiveRelevance: ['Maintain externally and internally observed service inventories.', 'Remove unnecessary listeners and restrict management interfaces.', 'Correlate scanner observations with firewall, asset-management, and endpoint telemetry.'],
      guidedPractice: [{ task: 'Annotate the sample TCP inventory with port, protocol, state, service, and version fields.', successCriteria: 'You identify each field and label the version as a fingerprint.' }, { task: 'Explain two reasons a UDP result can remain ambiguous.', successCriteria: 'You mention lack of response, filtering, ICMP behavior, or application-specific response.' }],
      independentChallenge: { scenario: 'An inventory scan sees TCP/22 open on a server, but the authenticated asset inventory reports SSH disabled.', deliverables: ['List at least three plausible explanations.', 'Rank the safest corroborating evidence sources.', 'Write a finding that does not assume the scanner or inventory is correct.'] },
      knowledgeCheck: [{ question: 'What does open|filtered mean in a UDP scan?', answer: 'The scan could not distinguish an open service from packet filtering.', rationale: 'UDP lacks a handshake and silence is ambiguous.' }, { question: 'Does a service banner prove a host is vulnerable?', answer: 'No.', rationale: 'Version fingerprints require verification and vulnerability applicability depends on configuration and patch state.' }],
      references: [{ label: 'Nmap Network Scanning — Reference Guide', url: 'https://nmap.org/book/man.html' }, { label: 'RFC 9293 — Transmission Control Protocol', url: 'https://www.rfc-editor.org/rfc/rfc9293' }, { label: 'RFC 768 — User Datagram Protocol', url: 'https://www.rfc-editor.org/rfc/rfc768' }]
    },
    {
      id: 'recon-analysis', title: 'Evidence quality, false positives, and reporting', level: 'Advanced', estimatedMinutes: 30,
      prerequisites: ['Complete TCP/IP, DNS, ports, and service discovery', 'Understand the difference between observation and inference'],
      concepts: [
        { term: 'Observation, inference, hypothesis', explanation: 'An observation is what a source directly reported. An inference is a reasoned interpretation. A hypothesis is a possible explanation that needs testing. Keep these categories separate in every finding.' },
        { term: 'Vantage point', explanation: 'A scan describes what was visible from one source network, at one time, under one policy. VPNs, NAT, load balancers, geofencing, and firewall rules can produce different views.' },
        { term: 'False positive and false negative', explanation: 'A false positive reports a condition that is not present or not applicable. A false negative misses a real condition. Rate limits, banners, proxies, stale data, and incomplete scope can contribute to both.' },
        { term: 'Risk prioritization', explanation: 'Prioritize by verified exposure, business criticality, exploit preconditions, compensating controls, and likely impact. A scanner severity label is a triage input, not a final risk decision.' }
      ],
      commandAnatomy: [{ syntax: 'searchsploit --title "Apache httpd"', parts: ['searchsploit searches a local exploit reference index in a real Kali installation', '--title narrows the title search', 'the query is a research lead, not a vulnerability verdict'], safety: 'Do not attempt exploit code against a target. Verify product, version, vendor backports, configuration, and advisory applicability through approved sources.' }],
      workedExample: { title: 'Convert a banner into a defensible note', command: 'Review the sample service fingerprint and compare with owner inventory', output: 'Sample observation: 80/tcp open; HTTP banner reports Apache httpd 2.4.41.\nOwner inventory: package release and patch status not yet confirmed.', interpretation: ['The banner is an externally observed fingerprint from the sample scanner.', 'The missing owner inventory is an explicit evidence gap.', 'A proportionate next step is authenticated package and configuration verification by the system owner.'], notEstablished: ['No CVE applicability has been established.', 'No exploit attempt or compromise has been observed.', 'A version string alone cannot account for vendor backported security fixes.'] },
      evidencePractice: [
        { observation: 'The scanner returned a product/version banner at a particular time and vantage point.', inference: 'A service presenting that banner was visible to that scanner.', hypothesis: 'The host may be running an outdated release; validate package metadata and vendor advisories.' }
      ],
      commonMistakes: [{ mistake: 'Copying scanner severity directly into a business risk rating.', correction: 'Document exploit preconditions, asset criticality, exposure, and compensating controls.' }, { mistake: 'Writing “vulnerable” based only on a product name.', correction: 'State the observed fingerprint and what verification remains.' }, { mistake: 'Omitting scan vantage point and time.', correction: 'Record source, timestamp, scope, options, and tool version.' }],
      defensiveRelevance: ['Use repeatable evidence so remediation can be verified.', 'Track false-positive adjudication and accepted risk with accountable owners.', 'Protect raw scan output and redact sensitive hostnames or data before sharing.'],
      guidedPractice: [{ task: 'Rewrite “Apache is vulnerable” as observation, inference, unknowns, and next validation.', successCriteria: 'No unsupported claim of exploitability remains.' }, { task: 'Prioritize two sample findings using exposure, impact, confidence, and verification cost.', successCriteria: 'The rationale is explicit and does not rely only on scanner severity.' }],
      independentChallenge: { scenario: 'Two scanners report different service versions for the same load-balanced hostname.', deliverables: ['Explain plausible technical reasons for the difference.', 'Define the minimum evidence needed to resolve it.', 'Write a concise finding with confidence, limitations, owner, and verification plan.'] },
      knowledgeCheck: [{ question: 'What is the strongest statement supported by a banner alone?', answer: 'A service presented that banner to the observing scanner at that time and vantage point.', rationale: 'A banner is not authenticated package inventory or proof of vulnerability.' }, { question: 'Should scanner severity alone determine remediation priority?', answer: 'No.', rationale: 'Prioritization should include verified exposure, business impact, exploit preconditions, compensating controls, and confidence.' }],
      references: [{ label: 'NIST SP 800-115', url: 'https://csrc.nist.gov/pubs/sp/800/115/final' }, { label: 'FIRST CVSS v4.0 Specification', url: 'https://www.first.org/cvss/v4.0/specification-document' }, { label: 'Nmap Service and Version Detection', url: 'https://nmap.org/book/vscan.html' }]
    }
  ]
};

const web: LearningModule = {
  labId: 'defensive-web-observation',
  overview: 'Learn how web requests, identity, sessions, access control, and browser security controls fit together. This lab uses fictional HTTP observations only and never contacts a website.',
  learningPath: ['Read an HTTP exchange', 'Understand authentication and session state', 'Reason about authorization and common web risks', 'Recommend and verify layered controls'],
  lessons: [
    {
      id: 'web-http', title: 'HTTP requests, responses, and security headers', level: 'Beginner', estimatedMinutes: 25,
      prerequisites: ['Basic client/server understanding', 'Know that browser output can be incomplete evidence'],
      concepts: [
        { term: 'HTTP request', explanation: 'A request includes a method, target, headers, and sometimes a body. GET commonly retrieves a representation; POST commonly submits data; PUT and DELETE have defined semantics. Actual application behavior must be checked against the API contract.' },
        { term: 'HTTP response', explanation: 'A response contains a status code, headers, and optional body. 2xx generally indicates success, 3xx redirection, 4xx client/request issues, and 5xx server-side errors. A status alone does not prove business authorization.' },
        { term: 'TLS', explanation: 'HTTPS protects transport confidentiality and integrity between TLS endpoints and authenticates the server name when certificate validation succeeds. TLS does not fix broken authorization or unsafe application logic.' },
        { term: 'Security headers', explanation: 'Headers such as Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, and Referrer-Policy can reduce specific browser risks. Their value depends on correct policy and deployment context; headers are not a substitute for secure application design.' }
      ],
      commandAnatomy: [{ syntax: 'curl -I https://app.example.test/', parts: ['curl is an HTTP client', '-I requests response headers only', 'the URL identifies the endpoint'], safety: 'A real request contacts a server and may be logged. Use only an approved test endpoint. This simulator does not run curl or send HTTP requests.' }],
      workedExample: { title: 'Read a sample HTTP response', command: 'Inspect the seeded response header record', output: 'HTTP/1.1 200 OK\nServer: Apache/2.4.41 (sample)\nContent-Type: text/html; charset=UTF-8\nX-Content-Type-Options: nosniff', interpretation: ['200 indicates the sample request succeeded at the HTTP layer.', 'Server is a software-identification header and may be altered or proxied.', 'Content-Type describes the representation; nosniff asks browsers not to MIME-sniff in supported contexts.'], notEstablished: ['The sample does not prove the software is installed at that exact version.', '200 does not prove the requester was authorized for every underlying object.', 'A single header snapshot does not establish complete browser or TLS security.'] },
      evidencePractice: [{ observation: 'A sample response includes Server: Apache/2.4.41.', inference: 'The response exposes a product/version string to this client.', hypothesis: 'The string may help fingerprinting; verify package state with the owner before assessing patch risk.' }],
      commonMistakes: [{ mistake: 'Treating a Server header as definitive software inventory.', correction: 'Corroborate with authenticated host inventory and deployment configuration.' }, { mistake: 'Assuming HTTPS makes an application secure.', correction: 'Assess identity, authorization, input handling, business logic, and browser controls independently.' }, { mistake: 'Adding headers without understanding compatibility.', correction: 'Define the threat addressed, test policy impact, and deploy with monitoring.' }],
      defensiveRelevance: ['Use a deliberate security-header baseline and test it in staging.', 'Keep software supported and patched even if version banners are hidden.', 'Validate TLS configuration and certificate lifecycle separately from application authorization.'],
      guidedPractice: [{ task: 'Annotate each line of the sample HTTP response.', successCriteria: 'You separate status, server fingerprint, content type, and security header.' }, { task: 'Explain one risk reduced by nosniff and one risk it does not address.', successCriteria: 'Your explanation does not overstate the header’s protection.' }],
      independentChallenge: { scenario: 'A team reports that a site is secure because it returns HTTP 200 over HTTPS and includes one security header.', deliverables: ['Identify at least four untested security properties.', 'Propose a staged validation plan.', 'Write a short correction that is accurate and non-alarmist.'] },
      knowledgeCheck: [{ question: 'Does HTTP 200 prove the user may access every record returned by the application?', answer: 'No.', rationale: 'HTTP status does not replace object-level authorization checks.' }],
      references: [{ label: 'RFC 9110 — HTTP Semantics', url: 'https://www.rfc-editor.org/rfc/rfc9110' }, { label: 'OWASP Secure Headers Project', url: 'https://owasp.org/www-project-secure-headers/' }, { label: 'MDN HTTP overview', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview' }]
    },
    {
      id: 'web-identity', title: 'Authentication, cookies, and session lifecycle', level: 'Intermediate', estimatedMinutes: 30,
      prerequisites: ['Complete HTTP requests, responses, and security headers', 'Understand user identity and least privilege'],
      concepts: [
        { term: 'Authentication versus authorization', explanation: 'Authentication establishes which principal is making a request. Authorization decides whether that principal may perform a specific action on a specific resource. A valid login does not grant unrestricted access.' },
        { term: 'Session cookie', explanation: 'A session cookie commonly carries an opaque identifier that maps to server-side session state. Secure, HttpOnly, and SameSite attributes reduce particular theft, script access, and cross-site request risks, but do not repair weak session handling.' },
        { term: 'Session lifecycle', explanation: 'Rotate session identifiers after authentication and privilege changes; enforce idle and absolute expiration; invalidate sessions on logout, password reset, and suspected compromise; protect session storage and signing keys.' },
        { term: 'CSRF and XSS', explanation: 'Cross-site request forgery abuses a browser’s ambient credentials to trigger unwanted actions. Cross-site scripting executes attacker-controlled script in a trusted origin. CSRF tokens/SameSite and contextual output encoding/CSP address different parts of the threat model.' }
      ],
      commandAnatomy: [{ syntax: 'Review Set-Cookie response attributes', parts: ['Secure restricts cookie transmission to secure channels', 'HttpOnly prevents access through document.cookie', 'SameSite controls cross-site cookie sending behavior', 'Path and Domain scope cookie delivery'], safety: 'Never paste real session cookies or bearer tokens into a report, chat, or screenshot. Use synthetic test accounts and redact identifiers.' }],
      workedExample: { title: 'Evaluate a fictional session cookie', command: 'Inspect the seeded Set-Cookie header', output: 'Set-Cookie: session=REDACTED; Secure; HttpOnly; SameSite=Lax; Path=/', interpretation: ['Secure and HttpOnly are present in this example.', 'SameSite=Lax provides a browser policy that can mitigate some cross-site request scenarios.', 'Path=/ makes the cookie available to matching paths on the host.'], notEstablished: ['The redacted value cannot be evaluated for entropy or predictability.', 'Cookie flags do not prove server-side session invalidation or rotation.', 'This sample does not test CSRF defenses, XSS, or authorization.'] },
      evidencePractice: [{ observation: 'The sample cookie includes Secure, HttpOnly, and SameSite=Lax.', inference: 'The response requests several browser-side cookie protections.', hypothesis: 'Session management may still be weak if identifiers are predictable, not rotated, or not invalidated server-side.' }],
      commonMistakes: [{ mistake: 'Treating cookie flags as proof of secure sessions.', correction: 'Test rotation, expiration, invalidation, binding, and server-side storage with synthetic accounts.' }, { mistake: 'Confusing login success with authorization to access an object.', correction: 'Test each role and object boundary independently.' }, { mistake: 'Sharing raw cookies during troubleshooting.', correction: 'Redact values and use controlled test sessions.' }],
      defensiveRelevance: ['Centralize session creation, rotation, expiry, and revocation.', 'Use MFA and re-authentication for sensitive actions where appropriate.', 'Monitor anomalous session reuse and privilege changes while minimizing personal data.'],
      guidedPractice: [{ task: 'Explain the purpose and limitation of each cookie attribute in the sample.', successCriteria: 'You do not claim that cookie flags guarantee secure session lifecycle.' }, { task: 'Design a safe session test using two synthetic users.', successCriteria: 'You cover login, privilege change, logout, expiry, and invalidation without using real user sessions.' }],
      independentChallenge: { scenario: 'A logout button redirects to the login page, but a previously authenticated browser tab may still display cached content.', deliverables: ['Distinguish UI navigation from server-side session invalidation.', 'Define an authorized test using a synthetic account and fresh request.', 'Specify evidence that proves revocation rather than merely a redirect.'] },
      knowledgeCheck: [{ question: 'What is the difference between authentication and authorization?', answer: 'Authentication establishes identity; authorization decides permitted actions on resources.', rationale: 'A successfully authenticated user can still be denied access to a specific object or operation.' }],
      references: [{ label: 'OWASP Session Management Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html' }, { label: 'OWASP Authentication Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html' }, { label: 'RFC 6265 — HTTP State Management Mechanism', url: 'https://www.rfc-editor.org/rfc/rfc6265' }]
    },
    {
      id: 'web-access-control', title: 'Access control, common vulnerability classes, and verification', level: 'Advanced', estimatedMinutes: 35,
      prerequisites: ['Complete the HTTP and session lessons', 'Understand roles, objects, and trust boundaries'],
      concepts: [
        { term: 'Object-level authorization', explanation: 'Every request that reads or changes an object must verify that the authenticated principal is allowed to act on that exact object. Hiding a button or changing a URL is not a security boundary.' },
        { term: 'IDOR/BOLA', explanation: 'Insecure Direct Object Reference or Broken Object Level Authorization occurs when changing an object identifier exposes another user’s resource. The key issue is missing server-side authorization, not whether IDs are sequential or hard to guess.' },
        { term: 'Injection', explanation: 'Injection occurs when untrusted input is interpreted as part of a command or query. Parameterized queries, safe APIs, strict validation, and context-aware encoding reduce risk; blacklists alone are fragile.' },
        { term: 'Verification and regression', explanation: 'A remediation is not complete when code is merged. Re-test the original condition, negative cases, role boundaries, logs, and regression suite. Record build/version, environment, test identity, expected result, and actual result.' }
      ],
      commandAnatomy: [{ syntax: 'Compare synthetic User A and User B access to object IDs', parts: ['Use two controlled test identities', 'Create one synthetic object for each identity', 'Attempt only documented read/update operations in an approved staging system', 'Capture allow/deny outcomes and server-side audit evidence'], safety: 'Never enumerate or access real users’ records. This product does not issue HTTP requests; the exercise is a test-design walkthrough.' }],
      workedExample: { title: 'Reason about a possible object authorization gap', command: 'Compare access policy for /api/invoices/1001 under two synthetic accounts', output: 'Account A owns synthetic invoice 1001: expected 200\nAccount B requests synthetic invoice 1001: expected 403 or non-disclosing 404\nSample observation: both requests returned 200 (fictional fixture)', interpretation: ['The fixture illustrates a possible object-level authorization failure.', 'The result is meaningful only if both identities and ownership were established independently.', 'A non-disclosing denial response can be appropriate, but consistency and audit behavior also matter.'], notEstablished: ['This fictional fixture does not prove a real application is vulnerable.', 'The status alone does not show whether sensitive fields were returned or whether a cache intervened.', 'No real account or invoice was accessed.'] },
      evidencePractice: [{ observation: 'In the fictional fixture, two synthetic accounts receive 200 for the same invoice.', inference: 'If account B does not own the invoice and the response contains its protected data, server-side object authorization may be missing.', hypothesis: 'A policy or tenant-isolation defect could permit cross-account access; verify in staging with synthetic records.' }],
      commonMistakes: [{ mistake: 'Relying on unguessable IDs as the only access control.', correction: 'Authorize every object action server-side regardless of identifier complexity.' }, { mistake: 'Testing with real customer records.', correction: 'Use synthetic tenants, accounts, and data with explicit approval.' }, { mistake: 'Calling a status code alone proof of a data leak.', correction: 'Inspect response content, ownership, identity, caching, and audit records in a controlled test.' }, { mistake: 'Closing a finding after deploying a code change.', correction: 'Reproduce the original case, test negative and regression cases, and record build provenance.' }],
      defensiveRelevance: ['Enforce deny-by-default authorization at service boundaries.', 'Use tenant-aware data access and regression tests for cross-tenant isolation.', 'Parameterize database operations and encode output for its context.', 'Log security-relevant decisions without storing secrets or unnecessary personal data.'],
      guidedPractice: [{ task: 'Write a two-user test matrix for read, update, and delete on a synthetic object.', successCriteria: 'Owner access and non-owner denial are tested for every operation.' }, { task: 'Turn the sample 200/200 fixture into a finding with preconditions and limitations.', successCriteria: 'The finding explains what additional response and ownership evidence is required.' }],
      independentChallenge: { scenario: 'A multi-tenant portal uses tenant_id from a client-submitted JSON body when creating a report.', deliverables: ['Explain the trust-boundary risk without assuming exploitability.', 'Design a synthetic cross-tenant test matrix.', 'Recommend server-derived tenant context, authorization checks, audit events, and regression tests.', 'Define a verification record for the fix.'] },
      knowledgeCheck: [{ question: 'Can an unpredictable UUID replace server-side object authorization?', answer: 'No.', rationale: 'Identifiers are references, not permission checks.' }, { question: 'What evidence is needed before confirming a BOLA finding?', answer: 'Verified identities and ownership, an authorized test, and evidence that a non-owner accessed protected object data or action.', rationale: 'A status code alone is insufficient.' }],
      references: [{ label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' }, { label: 'OWASP Authorization Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html' }, { label: 'OWASP API Security Top 10', url: 'https://owasp.org/www-project-api-security/' }]
    }
  ]
};

export const LEARNING_MODULES: LearningModule[] = [linux, recon, web];

export function getLearningModule(labId: string): LearningModule | undefined {
  return LEARNING_MODULES.find((module) => module.labId === labId);
}

export function validateLearningModule(module: LearningModule): string[] {
  const errors: string[] = [];
  if (!module.overview.trim()) errors.push('overview');
  if (module.learningPath.length < 3) errors.push('learningPath');
  if (module.lessons.length < 3) errors.push('lessons');
  const lessonIds = new Set<string>();
  for (const lesson of module.lessons) {
    if (lessonIds.has(lesson.id)) errors.push(`duplicate lesson id: ${lesson.id}`);
    lessonIds.add(lesson.id);
    if (!lesson.title.trim() || lesson.prerequisites.length === 0 || lesson.concepts.length < 3) errors.push(`${lesson.id}: prerequisites/concepts`);
    if (lesson.commandAnatomy.length === 0 || lesson.workedExample.interpretation.length < 2 || lesson.workedExample.notEstablished.length < 2) errors.push(`${lesson.id}: command/example interpretation`);
    if (lesson.evidencePractice.length === 0 || lesson.commonMistakes.length < 2 || lesson.defensiveRelevance.length < 2) errors.push(`${lesson.id}: evidence/troubleshooting/defensive relevance`);
    if (lesson.guidedPractice.length < 2 || lesson.independentChallenge.deliverables.length < 2 || lesson.knowledgeCheck.length < 2 || lesson.references.length < 2) errors.push(`${lesson.id}: practice/challenge/checks/references`);
    for (const reference of lesson.references) {
      if (!/^https:\/\//.test(reference.url)) errors.push(`${lesson.id}: invalid reference URL`);
    }
  }
  return errors;
}
