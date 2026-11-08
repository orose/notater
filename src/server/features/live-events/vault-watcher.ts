import { relative, sep } from 'node:path';
import { watch } from 'chokidar';
import { isIgnoredPath } from '../vault-index';

export interface VaultWatcher {
  /** Løses når den første skanningen er ferdig og hendelser leveres. */
  readonly ready: Promise<void>;
  close(): Promise<void>;
}

export interface WatchOptions {
  /** Hendelser samles i bunter (ADR-004: 150 ms). */
  readonly debounceMs?: number;
  /** `awaitWriteFinish`-terskel (Obsidian skriver i flere steg). */
  readonly stabilityThresholdMs?: number;
}

/**
 * Overvåker et vault med chokidar v4 og leverer debouncede bunter med vault-relative disk-stier
 * (filer og slettede mapper). Samme ignoreringsregler som skanningen.
 */
export function watchVault(
  root: string,
  ignore: readonly string[],
  onBatch: (diskPaths: string[]) => void,
  options: WatchOptions = {},
): VaultWatcher {
  const debounceMs = options.debounceMs ?? 150;
  const toRelative = (path: string): string => relative(root, path).split(sep).join('/');
  const watcher = watch(root, {
    ignoreInitial: true,
    ignored: (path: string) => {
      const rel = toRelative(path);
      return rel !== '' && !rel.startsWith('..') && isIgnoredPath(rel, ignore);
    },
    awaitWriteFinish: { stabilityThreshold: options.stabilityThresholdMs ?? 100, pollInterval: 25 },
  });

  let pending = new Set<string>();
  let timer: NodeJS.Timeout | null = null;
  const flush = (): void => {
    timer = null;
    const batch = [...pending];
    pending = new Set();
    if (batch.length > 0) onBatch(batch);
  };
  const enqueue = (path: string): void => {
    const rel = toRelative(path);
    if (rel === '' || rel.startsWith('..')) return;
    pending.add(rel);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  };

  for (const event of ['add', 'change', 'unlink', 'unlinkDir'] as const) watcher.on(event, enqueue);
  const ready = new Promise<void>((resolve) => watcher.once('ready', () => resolve()));

  return {
    ready,
    async close() {
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
