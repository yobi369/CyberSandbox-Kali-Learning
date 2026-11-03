/**
 * Match a submitted command against a lab step without accepting partial-token
 * matches (for example, "nmapx" must not satisfy an expected "nmap").
 */
const normalize = (value: string): string =>
  value.trim().toLowerCase().split(" ").filter(Boolean).join(" ");

export const matchesExpectedCommand = (
  command: string,
  expectedCommand?: string,
): boolean => {
  const actual = normalize(command);
  const expected = expectedCommand ? normalize(expectedCommand) : "";

  if (!actual || !expected) return false;

  if (!expected.includes(" ")) {
    return actual.split(" ").includes(expected);
  }

  return actual === expected || actual.startsWith(`${expected} `);
};
