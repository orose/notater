import { availableParallelism } from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { extractNoteMeta } from './extract-note-meta';
import type { NoteMeta } from './note-meta';

/** Henter metadata for mange notater. Implementasjonen kan være inline eller en worker-pool (ADR-004). */
export interface MetaExtractor {
  extractMany(sources: readonly string[]): Promise<NoteMeta[]>;
  close(): Promise<void>;
}

export function createInlineMetaExtractor(): MetaExtractor {
  return {
    extractMany: async (sources) => sources.map((s) => extractNoteMeta(s)),
    close: async () => undefined,
  };
}

interface WorkerRequest {
  readonly id: number;
  readonly sources: readonly string[];
}

interface WorkerResponse {
  readonly id: number;
  readonly metas?: NoteMeta[];
  readonly error?: string;
}

const CHUNK_SIZE = 20;

/** tsx-loaderen som absolutt URL, så workere virker uavhengig av prosessens cwd. */
function tsxLoaderUrl(): string {
  return pathToFileURL(createRequire(import.meta.url).resolve('tsx/package.json').replace(/package\.json$/, 'dist/loader.mjs')).href;
}

/** Standard poolstørrelse: alle kjerner (hovedtråden venter uansett under indeksering), maks 8. */
export function defaultPoolSize(): number {
  return Math.max(1, Math.min(8, availableParallelism()));
}

/**
 * Worker-pool for metadata-uttrekk. remark er for treg til å parse ~2000 notater på én tråd
 * innenfor AK17, så parsing fordeles på flere kjerner. Workerne laster TypeScript via tsx.
 */
export function createWorkerMetaExtractor(size: number = defaultPoolSize()): MetaExtractor {
  const workerUrl = new URL('./meta-worker.ts', import.meta.url);
  const workers = Array.from({ length: size }, () => new Worker(workerUrl, { execArgv: ['--import', tsxLoaderUrl()] }));
  const pending = new Map<number, { resolve: (m: NoteMeta[]) => void; reject: (e: Error) => void }>();
  let nextId = 0;

  for (const worker of workers) {
    worker.on('message', (msg: WorkerResponse) => {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.metas) entry.resolve(msg.metas);
      else entry.reject(new Error(msg.error ?? 'Ukjent feil i metadata-worker'));
    });
    worker.on('error', (error) => {
      for (const entry of pending.values()) entry.reject(error);
      pending.clear();
    });
  }

  const run = (worker: Worker, sources: readonly string[]): Promise<NoteMeta[]> =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, sources } satisfies WorkerRequest);
    });

  return {
    async extractMany(sources) {
      // Arbeidskø: hver worker henter neste bit når den er ferdig (jevn last selv om notatene varierer).
      const results = new Array<NoteMeta[]>(Math.ceil(sources.length / CHUNK_SIZE));
      let nextChunk = 0;
      const drain = async (worker: Worker): Promise<void> => {
        while (nextChunk < results.length) {
          const index = nextChunk++;
          results[index] = await run(worker, sources.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
        }
      };
      await Promise.all(workers.map(drain));
      return results.flat();
    },
    async close() {
      await Promise.all(workers.map((w) => w.terminate()));
    },
  };
}
