import { Hono } from 'hono';
import type { Revision, TreeResponse } from '../../../shared/api-types';
import { loadVault } from '../../shared/api-error';
import type { VaultFile } from '../vault-index';
import { buildTree } from './build-tree';

export type TreeSource = (vaultId: string) => Promise<{ readonly revision: Revision; readonly files: Iterable<VaultFile> } | null>;

/** `GET /api/vaults/:vaultId/tree`. */
export function createTreeRoutes(source: TreeSource): Hono {
  return new Hono().get('/api/vaults/:vaultId/tree', async (c) => {
    const vaultId = c.req.param('vaultId');
    const data = await loadVault(c, vaultId, source);
    if (data instanceof Response) return data;
    return c.json<TreeResponse>({ vaultId, revision: data.revision, root: buildTree(data.files) });
  });
}
