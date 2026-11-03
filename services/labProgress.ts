/**
 * Match a submitted command against a lab step without accepting partial-token
 * matches (for example, "nmapx" must not satisfy an expected "nmap").
 */
const normalize = (value: string): string =>
  value.trim().toLowerCase().split(" ").filter(Boolean).join(" ");

const COMMAND_NAMES = new Set([
  "whoami", "pwd", "ls", "cat", "date", "clear", "nmap", "nc",
  "dnsrecon", "amass", "dig", "gobuster", "dirb", "nikto",
  "searchsploit", "sqlmap", "hydra", "msfconsole", "echo",
]);

export const matchesExpectedCommand = (
  command: string,
  expectedCommand?: string,
): boolean => {
  const actual = normalize(command);
  const expected = expectedCommand ? normalize(expectedCommand) : "";

  if (!actual || !expected) return false;

  const actualTokens = actual.split(" ");
  if (!expected.includes(" ")) {
    return COMMAND_NAMES.has(expected)
      ? actualTokens[0] === expected
      : actualTokens.includes(expected);
  }

  return actual === expected || actual.startsWith(`${expected} `);
};
