/** live-events: chokidar → debounce → inkrementell indeksering → SSE (ADR-004). */
export { watchVault } from './vault-watcher';
export type { VaultWatcher, WatchOptions } from './vault-watcher';
export { createEventsRoutes } from './events-routes';
export type { EventSource, EventVault, EventsOptions } from './events-routes';
