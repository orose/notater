import { describe, expect, it } from 'vitest';
import { describeVaultPath } from '../vault-index';
import type { VaultFile } from '../vault-index';
import { buildTree } from './build-tree';

const file = (path: string): VaultFile => ({ ...describeVaultPath(path), diskPath: path, size: 0, mtimeMs: 0, ctimeMs: 0 });

describe('buildTree', () => {
  it('mapper først, så filer, nb-kollasjon case-insensitivt; navn og typer', () => {
    const root = buildTree(
      ['Velkommen.md', 'b.md', 'Oppgaver.base', 'Tegning.canvas', 'domene/Ærendelogg.md', 'domene/avtale.md', 'domene/Ordre.md', 'domene/delt/Adresse.md', 'attachments/logo.svg', 'Åpen.md', 'Zulu.md'].map(file),
    );
    expect(root).toMatchObject({ kind: 'folder', name: '', path: '' });
    expect(root.children.map((c) => `${c.kind}:${c.name}`)).toEqual([
      'folder:attachments',
      'folder:domene',
      'note:b',
      'base:Oppgaver.base',
      'unsupported:Tegning.canvas',
      'note:Velkommen',
      'note:Zulu',
      'note:Åpen',
    ]);
    const domene = root.children[1]!;
    expect(domene.kind === 'folder' && domene.children.map((c) => c.name)).toEqual(['delt', 'avtale', 'Ordre', 'Ærendelogg']);
    expect(domene).toMatchObject({ path: 'domene' });
    const delt = domene.kind === 'folder' ? domene.children[0]! : null;
    expect(delt).toMatchObject({ kind: 'folder', path: 'domene/delt', children: [{ kind: 'note', name: 'Adresse', path: 'domene/delt/Adresse' }] });
  });

  it('tomt vault gir tom rot', () => {
    expect(buildTree([])).toEqual({ kind: 'folder', name: '', path: '', children: [] });
  });
});
