/** Worker-tråd: tar imot notattekster og svarer med metadata. Startes av `createWorkerMetaExtractor`. */
import { parentPort } from 'node:worker_threads';
import { extractNoteMeta } from './extract-note-meta';

parentPort?.on('message', (msg: { id: number; sources: string[] }) => {
  try {
    parentPort?.postMessage({ id: msg.id, metas: msg.sources.map((s) => extractNoteMeta(s)) });
  } catch (error) {
    parentPort?.postMessage({ id: msg.id, error: error instanceof Error ? error.message : String(error) });
  }
});
