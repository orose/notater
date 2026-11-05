import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { HealthResponse } from '../../shared/api-types';

export interface AppOptions {
  /** Mappe med ferdigbygget frontend (Vite-output). Relativ til cwd. */
  readonly webRoot: string;
  readonly version: string;
}

/**
 * Komposisjonsrot for HTTP. Hver feature monterer sine egne ruter her
 * (f.eks. `app.route('/api/vaults', vaultRoutes(deps))`).
 */
export function createApp(options: AppOptions): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json<HealthResponse>({ status: 'ok', version: options.version }));

  app.use('/*', serveStatic({ root: options.webRoot }));
  // SPA-fallback: alle ikke-API-ruter får index.html slik at klient-ruting virker.
  app.get('*', (c, next) =>
    c.req.path.startsWith('/api/') ? next() : serveStatic({ root: options.webRoot, path: 'index.html' })(c, next),
  );

  return app;
}
