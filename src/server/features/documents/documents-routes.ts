import { Hono } from 'hono';
import type { BacklinksResponse, DocumentResponse } from '../../../shared/api-types';
import { apiError, loadVault, readPathParam } from '../../shared/api-error';
import type { BaseEvaluator } from '../bases';
import type { VaultState } from '../vault-registry';
import { getBacklinks, getDocument } from './document-service';

export type DocumentSource = (vaultId: string) => Promise<VaultState | null>;

/** Ekstra skjulte properties per vault (PO-22). */
export type HiddenPropertiesLookup = (vaultId: string) => readonly string[];

/** `GET /api/vaults/:vaultId/document?path=<DocPath>` og `GET …/backlinks?path=<mål>` (PO-28). */
export function createDocumentsRoutes(source: DocumentSource, bases: BaseEvaluator, hiddenProperties: HiddenPropertiesLookup = () => []): Hono {
  return new Hono()
    .get('/api/vaults/:vaultId/backlinks', async (c) => {
      const path = readPathParam(c);
      if (path === null) return apiError(c, 400, 'BAD_REQUEST', 'Mangler gyldig «path».');
      const state = await loadVault(c, c.req.param('vaultId'), source);
      if (state instanceof Response) return state;
      return c.json<BacklinksResponse>(getBacklinks(state, path));
    })
    .get('/api/vaults/:vaultId/document', async (c) => {
    const path = readPathParam(c);
    if (path === null) return apiError(c, 400, 'BAD_REQUEST', 'Mangler gyldig «path».');
    const state = await loadVault(c, c.req.param('vaultId'), source);
    if (state instanceof Response) return state;
    const document = getDocument(state, path, bases, { hiddenProperties: hiddenProperties(c.req.param('vaultId')) });
    if (!document) return apiError(c, 404, 'DOCUMENT_NOT_FOUND', `Fant ikke dokumentet «${path}».`);
    return c.json<DocumentResponse>(document);
  });
}
