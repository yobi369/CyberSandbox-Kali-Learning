/**
 * Match a submitted command against a lab step without accepting partial-token
 * matches (for example, "nmapx" must not satisfy an expected "nmap").
 */
export const matchesExpectedCommand = (
  command: string,
  expectedCommand?: string,
): boolean => {
  const actual = command.trim().toLowerCase().replace(/\\s+/g, " ");
  const expected = expectedCommand?.trim().toLowerCase().replace(/\\s+/g, " ");

  if (!actual || !expected) return false;

  if (!expected.includes(" ")) {
    return actual.split(" ").includes(expected);
  }

  return actual === expected || actual.startsWith(`${expected} `);
};
