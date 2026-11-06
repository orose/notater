import type { MiddlewareHandler } from 'hono';
import { apiError } from '../shared/api-error';

/** Vertsnavn som godtas i `Host` (A16: vern mot DNS-rebinding). Porten sjekkes ikke (Vite-proxy). */
const ALLOWED_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);

/** CSP for appens egne sider og API-svar (PO-16, B10). Vedlegg setter sin egen, strengere. */
export const APP_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ');

export function hostnameOf(hostHeader: string): string {
  const trimmed = hostHeader.trim().toLowerCase();
  if (trimmed.startsWith('[')) return trimmed.slice(0, trimmed.indexOf(']') + 1);
  return trimmed.replace(/:\d+$/, '');
}

/** Standard (AK20): bare 127.0.0.1 og localhost. */
export const isLocalHostname = (hostname: string): boolean => ALLOWED_HOSTNAMES.has(hostname);

/**
 * 403 når `Host` ikke er et tillatt vertsnavn (standard: 127.0.0.1/localhost; i LAN-modus også maskinens
 * egne IPv4-adresser og `<hostname>.local`, PO-3). Manglende Host (ikke-nettleser) slippes gjennom.
 */
export function hostGuard(isAllowed: (hostname: string) => boolean = isLocalHostname): MiddlewareHandler {
  return async (c, next) => {
    const host = c.req.header('host');
    if (host !== undefined && !isAllowed(hostnameOf(host))) {
      return apiError(c, 403, 'FORBIDDEN', 'Ukjent vertsnavn. Bruk http://127.0.0.1 eller http://localhost.');
    }
    await next();
  };
}

/** B1: kun lesing. Alt annet enn GET/HEAD → 405. */
export function readOnlyGuard(): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      c.header('Allow', 'GET, HEAD');
      return apiError(c, 405, 'BAD_REQUEST', 'Vault-leseren er skrivebeskyttet; kun GET er tillatt.');
    }
    await next();
  };
}

/** Sikkerhetsheadere på alle svar; en rute som har satt egen CSP (vedlegg) beholder den. */
export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    if (!c.res.headers.has('Content-Security-Policy')) c.res.headers.set('Content-Security-Policy', APP_CSP);
    c.res.headers.set('X-Content-Type-Options', 'nosniff');
    c.res.headers.set('Referrer-Policy', 'no-referrer');
  };
}
