
import { Lab } from './types';

export const LABS: Lab[] = [
  {
    id: 'deep-recon-full-chain',
    title: 'Simulated Reconnaissance Workflow',
    difficulty: 'Intermediate',
    category: 'Recon',
    description: 'A 25-step guided simulation for learning how reconnaissance evidence is collected, interpreted, and documented. All results are seeded examples.',
    objectives: [
      'Build a structured inventory from the provided fictional target evidence.',
      'Enumerate all DNS records and subdomains.',
      'Compare simulated scan profiles and explain their limitations.',
      'Identify exposed services that warrant defensive review.'
    ],
    hints: ['Information is the most powerful weapon.', 'Start broad, end specific.'],
    targetIp: '10.5.0.1',
    assessment: {
      prompt: 'Produce an analyst-quality reconnaissance note. Identify the exact observation and source, explain the security significance without claiming compromise, state confidence and evidence limitations, and recommend a prioritized defensive validation or mitigation.',
      criteria: [
        { id: 'observation', label: 'Evidence quality', dimension: 'evidence', signalGroups: [['apache 2.4.41', 'openssh', 'ssh'], ['port 80', 'port 22', 'tcp 80', 'tcp 22'], ['dns record', 'corp.internal', 'subdomain']], weight: 25, guidance: 'Cite exact evidence and its source.', strongAnswer: 'Record the exact service, port, DNS name or banner, where it appeared, and whether it came from the seeded output.' },
        { id: 'interpretation', label: 'Technical reasoning', dimension: 'reasoning', signalGroups: [['attack surface', 'service fingerprinting', 'service identification'], ['exposure', 'misconfiguration', 'unnecessary service'], ['because', 'could allow', 'may enable', 'therefore']], weight: 25, guidance: 'Explain why the observation matters and the conditions required for impact.', strongAnswer: 'Explain the causal relationship between the exposed service and a plausible risk, while distinguishing exposure from exploitability.' },
        { id: 'limitations', label: 'Confidence and limitations', dimension: 'confidence', signalGroups: [['simulated', 'seeded', 'training output', 'not live'], ['cannot confirm', 'not verified', 'does not prove', 'would need to verify']], weight: 25, guidance: 'State what this sample evidence cannot establish.', strongAnswer: 'Name an authorized independent validation step, such as confirming the service/version and reviewing vendor advisories.' },
        { id: 'recommendation', label: 'Defensive remediation', dimension: 'remediation', signalGroups: [['restrict access', 'firewall', 'disable unnecessary'], ['patch', 'update', 'supported version'], ['monitor', 'review', 'verify configuration']], weight: 25, guidance: 'Recommend a proportionate control tied to the observation.', strongAnswer: 'Prioritize exposure reduction or patching, assign an owner, and define a verification check.' }
      ]
    },
    steps: [
      { id: '1', instruction: 'Start with whoami to confirm your environment.', hint: 'whoami', expectedCommand: 'whoami', explanation: 'Verify your current shell permissions.' },
      { id: '2', instruction: 'Check your current directory for local intelligence.', hint: 'ls', expectedCommand: 'ls', explanation: 'Look for notes or wordlists provided for the mission.' },
      { id: '3', instruction: 'Read notes.txt to find your primary target details.', hint: 'cat notes.txt', expectedCommand: 'cat notes.txt', explanation: 'Notes often contain the IP addresses and domains relevant to the operation.' },
      { id: '4', instruction: 'Lookup the IP of "corp.internal" using dig.', hint: 'dig corp.internal', expectedCommand: 'dig', explanation: 'DNS resolution is the first step in any network operation.' },
      { id: '5', instruction: 'Perform a general DNS enumeration on corp.internal.', hint: 'dnsrecon -d corp.internal', expectedCommand: 'dnsrecon', explanation: 'Find MX, NS, and TXT records.' },
      { id: '6', instruction: 'Try a DNS Zone Transfer (AXFR) simulation.', hint: 'dnsrecon -d corp.internal -t axfr', expectedCommand: 'dnsrecon -d corp.internal -t axfr', explanation: 'Zone transfers can leak the entire internal DNS table if misconfigured.' },
      { id: '7', instruction: 'Use Amass to find passive subdomains.', hint: 'amass enum -d corp.internal', expectedCommand: 'amass', explanation: 'Subdomain discovery expands the known attack surface.' },
      { id: '8', instruction: 'Perform a basic Nmap scan on the target IP 10.5.0.1.', hint: 'nmap 10.5.0.1', expectedCommand: 'nmap 10.5.0.1', explanation: 'Identify which ports are open.' },
      { id: '9', instruction: 'Check if the host is up using a Ping scan.', hint: 'nmap -sn 10.5.0.1', expectedCommand: 'nmap -sn 10.5.0.1', explanation: 'Determine if the target responds to ICMP echo requests.' },
      { id: '10', instruction: 'Identify the OS and version info (-A).', hint: 'nmap -A 10.5.0.1', expectedCommand: 'nmap -A 10.5.0.1', explanation: 'Aggressive scanning provides service versions and OS guesses.' },
      { id: '11', instruction: 'Scan specifically for the top 100 ports.', hint: 'nmap --top-ports 100 10.5.0.1', expectedCommand: 'nmap --top-ports 100 10.5.0.1', explanation: 'Speed up scans by targeting common services.' },
      { id: '12', instruction: 'Grab the banner for port 80 using netcat.', hint: 'nc 10.5.0.1 80', expectedCommand: 'nc 10.5.0.1 80', explanation: 'Banner grabbing reveals the exact server software (e.g., Apache/nginx).' },
      { id: '13', instruction: 'Check port 22 for SSH versioning.', hint: 'nc 10.5.0.1 22', expectedCommand: 'nc 10.5.0.1 22', explanation: 'Identify the SSH version for potential exploit research.' },
      { id: '14', instruction: 'Scan for UDP services on the target.', hint: 'nmap -sU 10.5.0.1', expectedCommand: 'nmap -sU 10.5.0.1', explanation: 'UDP services are often overlooked but can be critical (DNS, SNMP).' },
      { id: '15', instruction: 'Use searchsploit to check for Apache 2.4.41 exploits.', hint: 'searchsploit Apache 2.4.41', expectedCommand: 'searchsploit', explanation: 'Link found versions to known public exploits.' },
      { id: '16', instruction: 'Search for OpenSSH exploits.', hint: 'searchsploit OpenSSH', expectedCommand: 'searchsploit', explanation: 'Check for potential remote code execution or authentication bypasses.' },
      { id: '17', instruction: 'Perform a directory brute force using gobuster.', hint: 'gobuster dir -u http://10.5.0.1 -w wordlist.txt', expectedCommand: 'gobuster', explanation: 'Discover hidden web directories like /admin or /config.' },
      { id: '18', instruction: 'Check for common web vulnerabilities with Nikto.', hint: 'nikto -h http://10.5.0.1', expectedCommand: 'nikto', explanation: 'Nikto identifies outdated plugins and common misconfigurations.' },
      { id: '19', instruction: 'Review the seeded robots.txt example.', hint: 'cat robots.txt', expectedCommand: 'cat robots.txt', explanation: 'Robots.txt can disclose paths that a site owner asks crawlers not to index; it is not an access-control mechanism.' },
      { id: '20', instruction: 'Review the blocked credential-guessing example and identify defensive controls.', hint: 'hydra -l admin -P wordlist.txt 10.5.0.1 ssh', expectedCommand: 'hydra', explanation: 'The simulator blocks credential guessing. In a defensive review, consider MFA, rate limits, lockout policy, and authentication telemetry.' },
      { id: '21', instruction: 'Interpret the sample TTL value and note why it is only an OS clue.', hint: 'nmap 10.5.0.1 (check details)', expectedCommand: 'nmap', explanation: 'Initial TTL values vary by stack and can be changed or obscured; treat this as a weak clue, not reliable OS identification.' },
      { id: '22', instruction: 'Scan for SSL/TLS vulnerabilities on port 443.', hint: 'nmap --script ssl-enum-ciphers -p 443 10.5.0.1', expectedCommand: 'nmap --script ssl-enum-ciphers -p 443 10.5.0.1', explanation: 'Identify weak encryption protocols.' },
      { id: '23', instruction: 'Check for SMB shares if port 445 is open.', hint: 'nmap --script smb-enum-shares -p 445 10.5.0.1', expectedCommand: 'nmap --script smb-enum-shares -p 445 10.5.0.1', explanation: 'Open shares can contain sensitive documents.' },
      { id: '24', instruction: 'Finalize the reconnaissance report by listing all findings.', hint: 'echo "Reporting..."', expectedCommand: 'echo', explanation: 'Consolidate all findings for the exploitation phase.' },
      { id: '25', instruction: 'Complete the local practice report step.', hint: 'echo Report complete', expectedCommand: 'echo Report complete', explanation: 'This completes the simulated exercise workflow; it is not proof of access to a remote target.' }
    ]
  },
  {
    id: 'linux-foundations',
    title: 'Linux Command-Line Foundations',
    difficulty: 'Beginner',
    category: 'Basics',
    description: 'Learn to orient yourself in a Linux training environment, inspect provided files, and perform a safe, simulated DNS lookup.',
    objectives: ['Identify the current training user and directory.', 'Inspect the supplied training notes.', 'Explain what a DNS lookup reveals.'],
    hints: ['Start by identifying your context.', 'Read the supplied notes before interpreting a target.'],
    targetIp: '192.0.2.10',
    assessment: {
      prompt: 'Write a short technical note explaining the training environment, what the commands established, how DNS resolution works, what was simulated, and how you would safely verify a real result in an authorized environment.',
      criteria: [
        { id: 'context', label: 'Evidence and context', dimension: 'evidence', signalGroups: [['whoami', 'training user', 'training environment'], ['working directory', 'pwd', 'local files', 'notes.txt']], weight: 25, guidance: 'Identify the training context and at least one inspected item.', strongAnswer: 'Record the training identity or working directory and cite the exact supplied file or command output.' },
        { id: 'dns', label: 'Technical reasoning', dimension: 'reasoning', signalGroups: [['dns maps', 'domain name', 'ip address'], ['record', 'resolver', 'name resolution'], ['because', 'therefore', 'lookup']], weight: 25, guidance: 'Explain how DNS maps names to records and what a lookup can establish.', strongAnswer: 'Explain the name-to-record resolution process and distinguish a DNS answer from proof that a service is reachable.' },
        { id: 'limitations', label: 'Confidence and limitations', dimension: 'confidence', signalGroups: [['simulated', 'example data', 'seeded', 'not live'], ['no dns request', 'cannot confirm', 'not verified', 'would need to verify']], weight: 25, guidance: 'Make clear that the displayed answer was not obtained from a live DNS resolver.', strongAnswer: 'State precisely what was simulated and what evidence a live authorized resolver query would provide.' },
        { id: 'next-step', label: 'Safe next step', dimension: 'remediation', signalGroups: [['document', 'record the result'], ['authorized', 'approved environment'], ['verify', 'compare', 'cross-check']], weight: 25, guidance: 'Describe a safe, authorized verification or documentation step.', strongAnswer: 'Specify the authorized resolver or environment, the record to verify, and how to document the result.' }
      ]
    },
    steps: [
      { id: '1', instruction: 'Identify the current training user.', hint: 'whoami', expectedCommand: 'whoami', explanation: 'The simulator reports a training identity only; it does not inspect the host operating system.' },
      { id: '2', instruction: 'Print the current training directory.', hint: 'pwd', expectedCommand: 'pwd', explanation: 'A working directory helps you understand where relative file paths are resolved.' },
      { id: '3', instruction: 'List the files provided for this exercise.', hint: 'ls', expectedCommand: 'ls', explanation: 'Inventory the training files before opening them.' },
      { id: '4', instruction: 'Read the exercise notes.', hint: 'cat notes.txt', expectedCommand: 'cat notes.txt', explanation: 'The notes contain seeded exercise context, not live system information.' },
      { id: '5', instruction: 'Request the example DNS record for lab.example.test.', hint: 'dig lab.example.test', expectedCommand: 'dig', explanation: 'DNS maps names to records. This simulator displays example data and sends no DNS request.' }
    ]
  },
  {
    id: 'defensive-web-observation',
    title: 'Defensive Web Surface Review',
    difficulty: 'Advanced',
    category: 'Web',
    description: 'Practice interpreting seeded web-assessment evidence and writing a defensible finding without sending requests to a real service.',
    objectives: ['Distinguish example scanner output from verified evidence.', 'Identify why software version disclosure matters.', 'Write a concise, evidence-based defensive recommendation.'],
    hints: ['A tool name does not make output real.', 'Separate an observation from an assumption and a recommendation.'],
    targetIp: '198.51.100.20',
    assessment: {
      prompt: 'Write a defensive web-surface finding suitable for a technical review. Cite the exact sample observation and source, explain plausible impact and prerequisites, calibrate confidence, and propose prioritized remediation with a verification method.',
      criteria: [
        { id: 'evidence', label: 'Evidence quality', dimension: 'evidence', signalGroups: [['apache 2.4.41', 'server header', 'http header'], ['robots.txt', 'version disclosure', 'banner'], ['observed', 'output showed', 'sample reported', 'header returned']], weight: 25, guidance: 'Cite the precise header, version, or path and identify it as sample output.', strongAnswer: 'Quote the exact header/version/path and identify the simulated scanner output as the source.' },
        { id: 'impact', label: 'Technical reasoning', dimension: 'reasoning', signalGroups: [['fingerprinting', 'information disclosure'], ['attack surface', 'targeted research', 'service identification'], ['because', 'could help', 'may enable', 'does not itself']], weight: 25, guidance: 'Explain a plausible security consequence without claiming that disclosure is itself an exploitable vulnerability.', strongAnswer: 'Describe how information can aid fingerprinting or prioritization, and explain why disclosure alone does not prove exploitability.' },
        { id: 'confidence', label: 'Confidence and limitations', dimension: 'confidence', signalGroups: [['simulated', 'seeded', 'training output', 'not live'], ['cannot confirm', 'not verified', 'does not prove', 'authorized verification']], weight: 25, guidance: 'State that scanner output is fictional and needs independent authorized verification.', strongAnswer: 'Identify the live evidence needed to confirm the header, software version, and actual exposure.' },
        { id: 'remediation', label: 'Defensive remediation', dimension: 'remediation', signalGroups: [['remove the banner', 'minimize banner', 'hide version'], ['patch', 'update', 'supported release'], ['verify', 'review', 'monitor', 'access control']], weight: 25, guidance: 'Recommend a proportionate control and a way to confirm it worked.', strongAnswer: 'Prioritize supported patching, minimize unnecessary version disclosure where appropriate, and verify the resulting configuration.' }
      ]
    },
    steps: [
      { id: '1', instruction: 'Review the seeded service inventory for the documentation-range target.', hint: 'nmap -sV 198.51.100.20', expectedCommand: 'nmap', explanation: 'The console returns a fixed sample. No packets are sent and the address is reserved for documentation examples.' },
      { id: '2', instruction: 'Load the sample web scanner exercise output.', hint: 'nikto -h http://demo.example.test', expectedCommand: 'nikto', explanation: 'The displayed output is fictional training evidence, not a live HTTP assessment.' },
      { id: '3', instruction: 'Review the local sample vulnerability research prompt.', hint: 'searchsploit Apache 2.4.41', expectedCommand: 'searchsploit', explanation: 'The simulator does not query Exploit-DB. Validate versions and vendor advisories independently in real defensive work.' },
      { id: '4', instruction: 'Summarize the evidence and a safe remediation recommendation.', hint: 'echo "Document evidence and remediation"', expectedCommand: 'echo', explanation: 'A useful finding distinguishes observed evidence, impact, confidence, and remediation.' }
    ]
  },
];

export const HELP_TEXT = `
Kali Linux Sandbox - Expanded Toolset:
--------------------------------------
SYSTEM:
ls, cat, whoami, pwd, clear, date, grep, touch

NETWORK RECON:
nmap [target]   - Multi-purpose scan (-sV, -A, -Pn)
nc [ip] [port]  - Read/Write across network (Netcat)
dnsrecon -d [dom]- DNS Enumeration
amass enum -d []- Subdomain Mapping
dig [domain]    - DNS Lookup

WEB EXPLOITATION:
nikto -h [url]  - Vulnerability Scanner
gobuster dir    - Directory Brute Force
dirb [url]      - Web path enumeration
sqlmap -u [url] - SQL Injection (Simulated)

EXPLOITATION:
msfconsole      - Metasploit Framework
searchsploit [] - Exploit Database lookup
hydra [args]    - Password Brute Forcer

TYPE "help" to see this list again.
`;

export const INITIAL_FILES = {
  'home/kali': {
    'notes.txt': 'Phase 1: Recon on 10.5.0.1. Phase 2: Web exploitation on 10.10.10.5.',
    'usernames.txt': 'admin\nuser\njdoe\nroot',
    'wordlist.txt': 'password\nadmin123\nqwerty',
    'robots.txt': 'User-agent: *\nDisallow: /admin/'
  }
};
