import { Hono } from 'hono';
import { apiError, loadVault, readPathParam } from '../../shared/api-error';
import type { VaultFile } from '../vault-index';
import { imageMimeType } from './asset-types';

export interface AssetVault {
  /** Oppslag KUN i indeksen (ADR-005). */
  find(docPath: string): VaultFile | null;
  /** Leser en indeksert fil fra disk (stien bygges fra vault-rot + indeksert relativ sti). */
  read(file: VaultFile): Promise<Uint8Array>;
}

export type AssetSource = (vaultId: string) => Promise<AssetVault | null>;

/** ADR-005/QA-IMG-12: SVG kan inneholde script – sandbox og ingen kilder utenom inline-stil. */
export const ASSET_CSP = "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'";

/** `GET /api/vaults/:vaultId/assets?path=<DocPath>` – kun hvitelistede bildetyper. */
export function createAssetsRoutes(source: AssetSource): Hono {
  return new Hono().get('/api/vaults/:vaultId/assets', async (c) => {
    const path = readPathParam(c);
    if (path === null) return apiError(c, 400, 'BAD_REQUEST', 'Mangler gyldig «path».');
    const vault = await loadVault(c, c.req.param('vaultId'), source);
    if (vault instanceof Response) return vault;
    const file = vault.find(path);
    const mime = file && file.kind === 'asset' ? imageMimeType(file.ext) : null;
    if (!file || !mime) return apiError(c, 404, 'ASSET_NOT_FOUND', `Fant ikke vedlegget «${path}».`);

    const etag = `"${Math.round(file.mtimeMs).toString(36)}-${file.size.toString(36)}"`;
    const headers = {
      'Cache-Control': 'no-cache',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': ASSET_CSP,
    };
    if (c.req.header('If-None-Match') === etag) return c.body(null, 304, headers);
    try {
      const bytes = await vault.read(file);
      return c.body(bytes as Uint8Array<ArrayBuffer>, 200, { ...headers, 'Content-Type': mime });
    } catch {
      return apiError(c, 404, 'ASSET_NOT_FOUND', `Fant ikke vedlegget «${path}».`);
    }
  });
}
