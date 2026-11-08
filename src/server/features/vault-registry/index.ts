/** vault-registry: vaultId → VaultRuntime (lat indeksering, revisjoner, inkrementelle oppdateringer). */
export { createVaultRegistry } from './vault-registry';
export type { VaultRegistry } from './vault-registry';
export { createVaultRuntime } from './vault-runtime';
export type { VaultRuntime, VaultRuntimeDeps, VaultState, WatcherHandle } from './vault-runtime';
export { createLruCache } from './lru-cache';
export type { LruCache } from './lru-cache';
export { createVaultsRoutes } from './vaults-routes';
export type { VaultListSource } from './vaults-routes';
