import { describe, expect, it } from 'vitest';
import { createSessionToken, hashPassword, hashSessionToken, parseCookies, verifyPassword } from './security.js';

describe('authentication security primitives', () => {
  it('creates opaque high-entropy session tokens and stores only stable hashes', () => {
    const token = createSessionToken();
    expect(token).toHaveLength(43);
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashSessionToken(token)).not.toBe(token);
  });

  it('hashes passwords with unique salts and verifies only the matching password', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');
    expect(first).not.toBe(second);
    expect(await verifyPassword('correct horse battery staple', first)).toBe(true);
    expect(await verifyPassword('incorrect password', first)).toBe(false);
  });

  it('rejects malformed hashes and unsafe password lengths', async () => {
    expect(await verifyPassword('anything', 'not-a-password-hash')).toBe(false);
    await expect(hashPassword('short')).rejects.toThrow();
  });

  it('parses cookies without throwing on malformed encodings', () => {
    expect(parseCookies('a=one; cybersandbox_session=abc%20123').cybersandbox_session).toBe('abc 123');
    expect(parseCookies('bad=%E0%A4%A')).toEqual({});
  });
});
