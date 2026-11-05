import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { HealthResponse } from '../../shared/api-types';
import { createAssetsRoutes } from '../features/assets';
import { createPendingBaseEvaluator } from '../features/bases';
import type { BaseEvaluator } from '../features/bases';
import { createDocumentsRoutes } from '../features/documents';
import { createEventsRoutes } from '../features/live-events';
import type { EventsOptions } from '../features/live-events';
import { createSearchRoutes } from '../features/search';
import { createTagsRoutes } from '../features/tags';
import { createTreeRoutes } from '../features/tree';
import { findByDocPath } from '../features/vault-index';
import { createVaultsRoutes } from '../features/vault-registry';
import type { VaultRegistry } from '../features/vault-registry';
import { apiError } from '../shared/api-error';
import { hostGuard, readOnlyGuard, securityHeaders } from './security';

export interface AppOptions {
  /** Mappe med ferdigbygget frontend (Vite-output). Relativ til cwd. */
  readonly webRoot: string;
  readonly version: string;
  readonly registry: VaultRegistry;
  /** Bases-evaluator (slice 3). Standard: «kommer senere»-resultat. */
  readonly bases?: BaseEvaluator;
  readonly events?: EventsOptions;
}

/**
 * Komposisjonsrot for HTTP. Hver feature eksporterer sin egen Hono-underapp med en smal port;
 * her kobles portene mot vault-registeret.
 */
export function createApp(options: AppOptions): Hono {
  const { registry } = options;
  const state = async (vaultId: string) => (await registry.get(vaultId)?.ready()) ?? null;
  const app = new Hono();

  app.use('*', securityHeaders());
  app.use('*', hostGuard());
  app.use('*', readOnlyGuard());

  app.get('/api/health', (c) => c.json<HealthResponse>({ status: 'ok', version: options.version }));
  app.route('/', createVaultsRoutes(registry));
  app.route(
    '/',
    createTreeRoutes(async (id) => {
      const s = await state(id);
      return s && { revision: s.revision, files: s.snapshot.files.values() };
    }),
  );
  app.route(
    '/',
    createDocumentsRoutes(state, options.bases ?? createPendingBaseEvaluator(), (id) => registry.get(id)?.hiddenProperties ?? []),
  );
  app.route(
    '/',
    createTagsRoutes(async (id) => {
      const s = await state(id);
      return s && { revision: s.revision, notes: s.snapshot.notes.values() };
    }),
  );
  app.route('/', createSearchRoutes(async (id) => (await registry.get(id)?.searchIndex()) ?? null));
  app.route(
    '/',
    createAssetsRoutes(async (id) => {
      const vault = registry.get(id);
      const s = await vault?.ready();
      if (!vault || !s) return null;
      return { find: (docPath) => findByDocPath(s.snapshot, docPath), read: (file) => vault.readFile(file) };
    }),
  );
  app.route('/', createEventsRoutes((id) => registry.get(id), options.events));
  app.all('/api/*', (c) => apiError(c, 404, 'NOT_FOUND', `Ukjent API-rute: ${c.req.path}`));

  app.use('/*', serveStatic({ root: options.webRoot }));
  // SPA-fallback: alle ikke-API-ruter får index.html slik at klient-ruting virker.
  app.get('*', serveStatic({ root: options.webRoot, path: 'index.html' }));

  return app;
}
