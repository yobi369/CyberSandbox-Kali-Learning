import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyToApi } from '../functions/proxy.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Cloudflare Pages same-origin API proxy', () => {
  it('forwards the path, query, request body, Origin and session cookie and preserves Set-Cookie', async () => {
    let captured: Request | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      captured = input instanceof Request ? input : new Request(input, init);
      return new Response('{"ok":true}', {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie': 'cybersandbox_session=synthetic; Path=/; HttpOnly; Secure; SameSite=Strict',
        },
      });
    }) as typeof fetch;

    const request = new Request('https://cybersandbox-demo.pages.dev/api/auth/login?next=%2Fhome', {
      method: 'POST',
      headers: {
        Origin: 'https://cybersandbox-demo.pages.dev',
        Cookie: 'cybersandbox_session=prior',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'synthetic@example.test' }),
    });

    const response = await proxyToApi(request, { API_ORIGIN: 'https://cybersandbox-api-free.onrender.com' });

    expect(captured?.url).toBe('https://cybersandbox-api-free.onrender.com/api/auth/login?next=%2Fhome');
    expect(captured?.headers.get('origin')).toBe('https://cybersandbox-demo.pages.dev');
    expect(captured?.headers.get('cookie')).toBe('cybersandbox_session=prior');
    expect(await captured?.text()).toBe('{"email":"synthetic@example.test"}');
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('cybersandbox_session=synthetic');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects a non-HTTPS or path-bearing API origin without forwarding', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as typeof fetch;
    const request = new Request('https://cybersandbox-demo.pages.dev/api/auth/session');

    const response = await proxyToApi(request, { API_ORIGIN: 'http://example.com/api' });

    expect(response.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
