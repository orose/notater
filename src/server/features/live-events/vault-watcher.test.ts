import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { watchVault } from './vault-watcher';
import type { VaultWatcher } from './vault-watcher';

let root: string;
let watcher: VaultWatcher | null = null;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vr-watch-'));
  await writeFile(join(root, 'Eksisterende.md'), '# Før');
  await mkdir(join(root, '.obsidian'));
});

afterEach(async () => {
  await watcher?.close();
  watcher = null;
  await rm(root, { recursive: true, force: true });
});

function nextBatch(): { promise: Promise<string[]>; onBatch: (paths: string[]) => void } {
  let resolve!: (paths: string[]) => void;
  const promise = new Promise<string[]>((r) => (resolve = r));
  return { promise, onBatch: (paths) => resolve(paths) };
}

describe('watchVault', () => {
  it('samler endringer i én debouncet bunt med vault-relative stier, ignorerer dot-mapper', async () => {
    const batch = nextBatch();
    watcher = watchVault(root, [], batch.onBatch, { debounceMs: 100, stabilityThresholdMs: 30 });
    await watcher.ready;
    await writeFile(join(root, 'Ny.md'), '# Ny');
    await writeFile(join(root, 'Eksisterende.md'), '# Etter');
    await writeFile(join(root, '.obsidian', 'workspace.json'), '{}');
    await unlink(join(root, 'Eksisterende.md'));
    const paths = await batch.promise;
    expect(paths).toContain('Ny.md');
    expect(paths).toContain('Eksisterende.md');
    expect(paths.some((p) => p.startsWith('.obsidian'))).toBe(false);
  }, 10_000);
});
