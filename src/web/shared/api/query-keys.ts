import type { DocPath, VaultId } from '../../../shared/api-types';

// Alle vault-nøkler starter med ['vault', vaultId] slik at én SSE-hendelse kan invalidere alt (api.md).
export const queryKeys = {
  vaults: () => ['vaults'] as const,
  vault: (vaultId: VaultId) => ['vault', vaultId] as const,
  tree: (vaultId: VaultId) => ['vault', vaultId, 'tree'] as const,
  document: (vaultId: VaultId, docPath: DocPath) => ['vault', vaultId, 'document', docPath] as const,
  search: (vaultId: VaultId, q: string) => ['vault', vaultId, 'search', q] as const,
  tags: (vaultId: VaultId) => ['vault', vaultId, 'tags'] as const,
};
