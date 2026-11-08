import { vi } from 'vitest';

type Handler = unknown | ((url: URL) => unknown);

export interface ApiMock {
  readonly calls: URL[];
}

/**
 * Tynn mock av API-kontrakten (src/shared/api-types.ts) for komponenttester.
 * Nøkkel = pathname + evt. `?path=`-verdi, f.eks. `/api/vaults/test/document?path=Velkommen`.
 * Ukjente ruter gir 404 med ApiError.
 */
export function mockApi(routes: Record<string, Handler>): ApiMock {
  const calls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://127.0.0.1');
      calls.push(url);
      const path = url.searchParams.get('path');
      const q = url.searchParams.get('q');
      const keys = [
        path !== null ? `${url.pathname}?path=${path}` : null,
        q !== null ? `${url.pathname}?q=${q}` : null,
        url.pathname,
      ].filter((k): k is string => k !== null);
      for (const key of keys) {
        if (key in routes) {
          const handler = routes[key];
          const body = typeof handler === 'function' ? (handler as (u: URL) => unknown)(url) : handler;
          if (body instanceof Response) return body;
          return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }
      return new Response(JSON.stringify({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'Finnes ikke' } }), { status: 404 });
    }),
  );
  return { calls };
}
