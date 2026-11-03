
import { Lab } from './types';

export const LABS: Lab[] = [
  {
    id: 'deep-recon-full-chain',
    title: 'Professional Reconnaissance Masterclass',
    difficulty: 'Intermediate',
    category: 'Recon',
    description: 'An exhaustive 25-step reconnaissance operation covering everything from initial DNS discovery to deep service banner analysis.',
    objectives: [
      'Map the external attack surface.',
      'Enumerate all DNS records and subdomains.',
      'Perform stealthy and aggressive port scanning.',
      'Identify service versions and potential entry points.'
    ],
    hints: ['Information is the most powerful weapon.', 'Start broad, end specific.'],
    targetIp: '10.5.0.1',
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
      { id: '20', instruction: 'Simulate a login probe with Hydra.', hint: 'hydra -l admin -P wordlist.txt 10.5.0.1 ssh', expectedCommand: 'hydra', explanation: 'Test for weak credentials on exposed services.' },
      { id: '21', instruction: 'Analyze the TTL of the ping response to guess the OS.', hint: 'nmap 10.5.0.1 (check details)', expectedCommand: 'nmap', explanation: 'TTL 64 usually indicates Linux, 128 indicates Windows.' },
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
    'wordlist.txt': 'password\nadmin123\nqwerty',\n    'robots.txt': 'User-agent: *\nDisallow: /admin/'
  }
};
