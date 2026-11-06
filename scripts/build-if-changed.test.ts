import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILD_INPUTS, buildHash, needsBuild, writeStamp } from './build-if-changed';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'vr-build-'));
  mkdirSync(join(root, 'src/web/app'), { recursive: true });
  writeFileSync(join(root, 'src/web/app/App.tsx'), 'export const a = 1;');
  writeFileSync(join(root, 'package-lock.json'), '{}');
  return root;
}

describe('build-if-changed (PO-4)', () => {
  it('hasher kildene til nettsiden', () => {
    expect(BUILD_INPUTS).toEqual(expect.arrayContaining(['src/web', 'src/shared', 'docs/design', 'vite.config.ts', 'package-lock.json']));
  });

  it('samme kilde gir samme hash; endret fil gir ny hash', () => {
    const root = fixture();
    const first = buildHash(root);
    expect(buildHash(root)).toBe(first);
    writeFileSync(join(root, 'src/web/app/App.tsx'), 'export const a = 2;');
    expect(buildHash(root)).not.toBe(first);
  });

  it('ny fil gir ny hash', () => {
    const root = fixture();
    const first = buildHash(root);
    writeFileSync(join(root, 'src/web/app/Ny.tsx'), 'x');
    expect(buildHash(root)).not.toBe(first);
  });

  it('bygger når dist mangler, stempelet mangler eller hashen er endret – ellers ikke', () => {
    const root = fixture();
    const hash = buildHash(root);
    expect(needsBuild(root, hash)).toBe(true); // ingen dist
    mkdirSync(join(root, 'dist/web'), { recursive: true });
    writeFileSync(join(root, 'dist/web/index.html'), '<!doctype html>');
    expect(needsBuild(root, hash)).toBe(true); // intet stempel
    writeStamp(root, hash);
    expect(needsBuild(root, hash)).toBe(false);
    expect(needsBuild(root, 'annen')).toBe(true);
  });
});
