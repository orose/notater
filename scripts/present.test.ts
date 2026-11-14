import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PRESENT_INPUTS, needsBuild, sourceStamp } from './present.mjs';

let root: string | null = null;
afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true });
  root = null;
});

function fixture(): string {
  root = mkdtempSync(join(tmpdir(), 'vr-present-'));
  mkdirSync(join(root, 'src/terminal'), { recursive: true });
  writeFileSync(join(root, 'src/terminal/main.ts'), 'export const a = 1;');
  return root;
}

describe('present.mjs (ADR-011 M2)', () => {
  it('bygger fra terminal, kjerne, server, delte typer og lockfila', () => {
    expect(PRESENT_INPUTS).toEqual(expect.arrayContaining(['src/terminal', 'src/core', 'src/server', 'src/shared', 'package-lock.json']));
  });

  it('samme kilde gir samme stempel; endret fil eller ny fil gir nytt; tester teller ikke', () => {
    const dir = fixture();
    const first = sourceStamp(dir);
    expect(sourceStamp(dir)).toBe(first);
    writeFileSync(join(dir, 'src/terminal/main.test.ts'), 'x');
    expect(sourceStamp(dir)).toBe(first);
    writeFileSync(join(dir, 'src/terminal/main.ts'), 'export const a = 22;');
    utimesSync(join(dir, 'src/terminal/main.ts'), new Date(), new Date(Date.now() + 5000));
    const second = sourceStamp(dir);
    expect(second).not.toBe(first);
    writeFileSync(join(dir, 'src/terminal/ny.ts'), 'x');
    expect(sourceStamp(dir)).not.toBe(second);
  });

  it('mangler bunten, må den bygges', () => {
    const dir = fixture();
    expect(needsBuild(dir, sourceStamp(dir))).toBe(true);
  });
});
