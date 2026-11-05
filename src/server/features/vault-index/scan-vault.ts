import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { isIgnoredPath } from './vault-paths';

/** En fil slik den ligger på disk. `diskPath` er vault-relativ med original Unicode-form. */
export interface ScannedFile {
  readonly diskPath: string;
  readonly size: number;
  readonly mtimeMs: number;
  readonly ctimeMs: number;
}

/**
 * Bygger absolutt disk-sti fra vault-rot + vault-relativ sti og verifiserer at den ligger inne i
 * vaultet (ADR-005). Kaster ved forsøk på å gå ut.
 */
export function resolveInsideVault(root: string, diskPath: string): string {
  if (diskPath.includes('\0')) throw new Error('Ugyldig sti');
  const absolute = join(root, diskPath);
  const rel = relative(root, absolute);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new Error('Sti utenfor vaultet');
  return absolute;
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/** Alle indekserbare filer i vaultet (ignorerte mapper og symlenker ut av vaultet utelates). */
export async function scanVault(root: string, ignorePrefixes: readonly string[]): Promise<ScannedFile[]> {
  const realRoot = await realpath(root);
  const entries = await readdir(realRoot, { recursive: true, withFileTypes: true });
  const candidates = entries
    .map((entry) => ({ entry, diskPath: relative(realRoot, join(entry.parentPath, entry.name)).split(sep).join('/') }))
    .filter(({ entry, diskPath }) => (entry.isFile() || entry.isSymbolicLink()) && !isIgnoredPath(diskPath, ignorePrefixes));

  const results = await mapWithConcurrency(candidates, 64, async ({ entry, diskPath }) => {
    if (entry.isSymbolicLink()) {
      const target = await realpath(join(realRoot, diskPath)).catch(() => null);
      if (!target || !isInside(realRoot, target)) return null;
    }
    return statVaultFile(realRoot, diskPath);
  });
  return results.filter((f): f is ScannedFile => f !== null);
}

/** Stat for én fil; `null` hvis den ikke finnes eller ikke er en vanlig fil. */
export async function statVaultFile(root: string, diskPath: string): Promise<ScannedFile | null> {
  try {
    const info = await stat(resolveInsideVault(root, diskPath));
    if (!info.isFile()) return null;
    return { diskPath, size: info.size, mtimeMs: info.mtimeMs, ctimeMs: info.birthtimeMs || info.ctimeMs };
  } catch {
    return null;
  }
}

export async function readVaultText(root: string, diskPath: string): Promise<string> {
  return readFile(resolveInsideVault(root, diskPath), 'utf8');
}

export async function readVaultBytes(root: string, diskPath: string): Promise<Buffer> {
  return readFile(resolveInsideVault(root, diskPath));
}

export async function mapWithConcurrency<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}
