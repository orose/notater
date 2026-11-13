import { availableParallelism } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { extractNoteMeta } from './extract-note-meta';
import type { NoteMeta } from './note-meta';

/** Henter metadata for mange notater. Implementasjonen kan være inline eller en worker-pool (ADR-004). */
export interface MetaExtractor {
  /** `onProgress(ferdige)` kalles etter hver ferdige bit (fremdrift ved oppstart, SV3). */
  extractMany(sources: readonly string[], onProgress?: (done: number) => void): Promise<NoteMeta[]>;
  close(): Promise<void>;
}

export function createInlineMetaExtractor(): MetaExtractor {
  return {
    extractMany: async (sources, onProgress) => {
      const metas = sources.map((s) => extractNoteMeta(s));
      onProgress?.(sources.length);
      return metas;
    },
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

let bundledWorker: Promise<string | null> | null = null;

/**
 * Worker-koden som én CommonJS-bunt (esbuild, i minnet). En worker som laster TypeScript via tsx bruker
 * ~1 s på å starte (hver modul går gjennom loader-krokene); bunten starter på ~0,15 s. `null` hvis
 * buntingen feiler – da brukes tsx som før.
 */
export function bundledWorkerSource(): Promise<string | null> {
  bundledWorker ??= import('esbuild')
    .then(({ build }) =>
      build({
        entryPoints: [fileURLToPath(new URL('./meta-worker.ts', import.meta.url))],
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node22',
        write: false,
        logLevel: 'silent',
      }),
    )
    .then((result) => result.outputFiles[0]?.text ?? null)
    .catch(() => null);
  return bundledWorker;
}

function startWorker(bundle: string | null): Worker {
  if (bundle !== null) return new Worker(bundle, { eval: true });
  return new Worker(new URL('./meta-worker.ts', import.meta.url), { execArgv: ['--import', tsxLoaderUrl()] });
}

/**
 * Worker-pool for metadata-uttrekk. remark er for treg til å parse ~2000 notater på én tråd
 * innenfor AK17, så parsing fordeles på flere kjerner. Workerne kjører en ferdig bunt (se
 * `bundledWorkerSource`); poolen startes med en gang og venter ikke på kallet til `extractMany`.
 */
export function createWorkerMetaExtractor(size: number = defaultPoolSize(), workerSource: () => Promise<string | null> = bundledWorkerSource): MetaExtractor {
  const pending = new Map<number, { resolve: (m: NoteMeta[]) => void; reject: (e: Error) => void }>();
  let nextId = 0;
  let closed = false;

  const workersReady: Promise<Worker[]> = workerSource().then((bundle) => {
    const workers = Array.from({ length: size }, () => startWorker(bundle));
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
    if (closed) void Promise.all(workers.map((w) => w.terminate()));
    return workers;
  });

  const run = (worker: Worker, sources: readonly string[]): Promise<NoteMeta[]> =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, sources } satisfies WorkerRequest);
    });

  return {
    async extractMany(sources, onProgress) {
      // Arbeidskø: hver worker henter neste bit når den er ferdig (jevn last selv om notatene varierer).
      const results = new Array<NoteMeta[]>(Math.ceil(sources.length / CHUNK_SIZE));
      let nextChunk = 0;
      let done = 0;
      const drain = async (worker: Worker): Promise<void> => {
        while (nextChunk < results.length) {
          const index = nextChunk++;
          results[index] = await run(worker, sources.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
          done += results[index].length;
          onProgress?.(done);
        }
      };
      await Promise.all((await workersReady).map(drain));
      return results.flat();
    },
    async close() {
      closed = true;
      await Promise.all((await workersReady).map((w) => w.terminate()));
    },
  };
}
