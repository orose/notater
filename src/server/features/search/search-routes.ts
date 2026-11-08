import { Hono } from 'hono';
import type { Revision, SearchResponse } from '../../../shared/api-types';
import { loadVault } from '../../shared/api-error';
import type { SearchIndex } from './search-index';

export type SearchSource = (vaultId: string) => Promise<{ readonly index: SearchIndex; readonly revision: Revision } | null>;

export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 50;

/** `GET /api/vaults/:vaultId/search?q=<tekst>&limit=<n>` – limit standard 20, maks 50. */
export function createSearchRoutes(source: SearchSource): Hono {
  return new Hono().get('/api/vaults/:vaultId/search', async (c) => {
    const query = c.req.query('q') ?? '';
    const requested = Number.parseInt(c.req.query('limit') ?? '', 10);
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_SEARCH_LIMIT) : DEFAULT_SEARCH_LIMIT;
    const data = await loadVault(c, c.req.param('vaultId'), source);
    if (data instanceof Response) return data;
    return c.json<SearchResponse>({ query, revision: data.revision, hits: data.index.search(query, limit) });
  });
}
