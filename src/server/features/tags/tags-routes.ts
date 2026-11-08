import { Hono } from 'hono';
import type { Revision, TagsResponse } from '../../../shared/api-types';
import { loadVault } from '../../shared/api-error';
import type { IndexedNote } from '../vault-index';
import { buildTagCounts } from './tag-counts';

export type TagsSource = (vaultId: string) => Promise<{ readonly revision: Revision; readonly notes: Iterable<IndexedNote> } | null>;

/** `GET /api/vaults/:vaultId/tags` (PO-24). */
export function createTagsRoutes(source: TagsSource): Hono {
  return new Hono().get('/api/vaults/:vaultId/tags', async (c) => {
    const vaultId = c.req.param('vaultId');
    const data = await loadVault(c, vaultId, source);
    if (data instanceof Response) return data;
    return c.json<TagsResponse>({ vaultId, revision: data.revision, tags: buildTagCounts(data.notes) });
  });
}
