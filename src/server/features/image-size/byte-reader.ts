import { open } from 'node:fs/promises';

/**
 * Tilfeldig tilgang til bytene i en fil. `read` returnerer færre byte enn bedt om ved filslutt, og aldri
 * byte utenfor fila. Parserne leser bare små biter (headere), aldri hele fila.
 */
export interface ByteReader {
  read(offset: number, length: number): Promise<Uint8Array>;
}

/** Leser fra en buffer i minnet (tester, og filer som allerede er lest). */
export function bufferReader(bytes: Uint8Array): ByteReader {
  return {
    read: async (offset, length) => bytes.subarray(Math.max(0, offset), Math.max(0, offset) + Math.max(0, length)),
  };
}

/** Byte som leses med én gang ved åpning; dekker headeren i nesten alle bilder. */
const PREFETCH_BYTES = 4096;

/**
 * Åpner en fil, leser de første `PREFETCH_BYTES` og gir `fn` en leser som svarer fra den biten når den kan
 * og ellers gjør posisjonslesing (f.eks. når JPEG-parseren hopper over store EXIF/ICC-segmenter).
 * Fila lukkes alltid.
 */
export async function withFileReader<T>(absolutePath: string, fn: (reader: ByteReader) => Promise<T>): Promise<T> {
  const handle = await open(absolutePath, 'r');
  try {
    const head = Buffer.alloc(PREFETCH_BYTES);
    const { bytesRead } = await handle.read(head, 0, PREFETCH_BYTES, 0);
    const prefix = head.subarray(0, bytesRead);
    const complete = bytesRead < PREFETCH_BYTES;
    return await fn({
      read: async (offset, length) => {
        if (offset < 0 || length <= 0) return new Uint8Array(0);
        if (complete || offset + length <= prefix.length) return prefix.subarray(offset, offset + length);
        const chunk = Buffer.alloc(length);
        const result = await handle.read(chunk, 0, length, offset);
        return chunk.subarray(0, result.bytesRead);
      },
    });
  } finally {
    await handle.close();
  }
}
