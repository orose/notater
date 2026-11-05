import type { AppConfig } from '../config';
import { createVaultRuntime } from './vault-runtime';
import type { VaultRuntime, VaultRuntimeDeps } from './vault-runtime';

/** vaultId → VaultRuntime. Ingen «aktivt vault» på serveren (A12); indekser opprettes lat. */
export interface VaultRegistry {
  readonly defaultVaultId: string;
  list(): readonly VaultRuntime[];
  get(id: string): VaultRuntime | null;
  close(): Promise<void>;
}

export function createVaultRegistry(config: Pick<AppConfig, 'vaults' | 'defaultVaultId'>, deps: VaultRuntimeDeps): VaultRegistry {
  const vaults = new Map(config.vaults.map((v) => [v.id, createVaultRuntime(v, deps)]));
  return {
    defaultVaultId: config.defaultVaultId,
    list: () => [...vaults.values()],
    get: (id) => vaults.get(id) ?? null,
    close: async () => {
      await Promise.all([...vaults.values()].map((v) => v.close()));
    },
  };
}
