import { Hono } from 'hono';
import type { VaultSummary, VaultsResponse } from '../../../shared/api-types';

export interface VaultListSource {
  readonly defaultVaultId: string;
  list(): readonly { summary(): VaultSummary }[];
}

/** `GET /api/vaults` – vault-stier på disk eksponeres aldri. */
export function createVaultsRoutes(source: VaultListSource): Hono {
  return new Hono().get('/api/vaults', (c) =>
    c.json<VaultsResponse>({ vaults: source.list().map((v) => v.summary()), defaultVaultId: source.defaultVaultId }),
  );
}
