import { proxyToApi, type ProxyEnvironment } from './proxy.js';

export function onRequest(context: { request: Request; env: ProxyEnvironment }): Promise<Response> {
  return proxyToApi(context.request, context.env);
}
