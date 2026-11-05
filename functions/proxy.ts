export interface ProxyEnvironment {
  API_ORIGIN: string;
}

/**
 * Reverse-proxy API requests through the Pages origin. The browser therefore
 * stores the API's host-only HttpOnly cookie on the Pages host, avoiding
 * third-party cookies and cross-site SameSite restrictions.
 */
export async function proxyToApi(request: Request, env: ProxyEnvironment): Promise<Response> {
  const apiOrigin = new URL(env.API_ORIGIN);
  if (apiOrigin.protocol !== 'https:' || apiOrigin.pathname !== '/' || apiOrigin.search || apiOrigin.hash) {
    return new Response('API_ORIGIN must be an HTTPS origin without a path.', {
      status: 500,
      headers: { 'cache-control': 'no-store' },
    });
  }

  const incoming = new URL(request.url);
  const destination = new URL(incoming.pathname + incoming.search, apiOrigin);
  const upstream = await fetch(new Request(destination, request));

  // Clone the upstream response without dropping Set-Cookie, status, or body.
  // API responses must never be cached by the Pages CDN.
  const response = new Response(upstream.body, upstream);
  response.headers.set('cache-control', 'no-store');
  return response;
}
