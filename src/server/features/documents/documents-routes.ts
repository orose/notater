import { Hono } from 'hono';
import type { DocumentResponse } from '../../../shared/api-types';
import { apiError, loadVault, readPathParam } from '../../shared/api-error';
import type { BaseEvaluator } from '../bases';
import type { VaultState } from '../vault-registry';
import { getDocument } from './document-service';

export type DocumentSource = (vaultId: string) => Promise<VaultState | null>;

/** `GET /api/vaults/:vaultId/document?path=<DocPath>`. */
export function createDocumentsRoutes(source: DocumentSource, bases: BaseEvaluator): Hono {
  return new Hono().get('/api/vaults/:vaultId/document', async (c) => {
    const path = readPathParam(c);
    if (path === null) return apiError(c, 400, 'BAD_REQUEST', 'Mangler gyldig «path».');
    const state = await loadVault(c, c.req.param('vaultId'), source);
    if (state instanceof Response) return state;
    const document = getDocument(state, path, bases);
    if (!document) return apiError(c, 404, 'DOCUMENT_NOT_FOUND', `Fant ikke dokumentet «${path}».`);
    return c.json<DocumentResponse>(document);
  });
}
