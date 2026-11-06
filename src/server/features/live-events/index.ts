/** live-events: chokidar → debounce → inkrementell indeksering → SSE (ADR-004). */
export { watchVault } from './vault-watcher';
export type { VaultWatcher, WatchOptions } from './vault-watcher';
export { createDeletionHold } from './deletion-hold';
export type { BatchClassification, DeletionHold, DeletionHoldOptions } from './deletion-hold';
export { createEventsRoutes } from './events-routes';
export type { EventSource, EventVault, EventsOptions } from './events-routes';
