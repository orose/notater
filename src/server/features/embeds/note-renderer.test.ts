import type { Element, Root } from 'hast';
import { beforeAll, describe, expect, it } from 'vitest';
import type { CodeHighlighter } from '../code-highlight';
import { createLinkResolver } from '../links';
import { byTag, findAll, testHighlighter, textOf } from '../markdown/test-support';
import { splitFrontmatter } from '../markdown-syntax';
import { describeVaultPath, extractNoteMeta } from '../vault-index';
import type { IndexedNote, VaultFile } from '../vault-index';
import { createNoteRenderer } from './note-renderer';

let highlighter: CodeHighlighter;
beforeAll(async () => {
  highlighter = await testHighlighter();
}, 30_000);

const SOURCES: Record<string, string> = {
  'Embed-test.md': '![[Syklus A]]\n\n![[Kafka#Partisjoner]]\n\n![[Kafka#^offset-def]]\n\n![[Finnes ikke]]\n\n![[Kafka#Finnes ikke]]',
  'Syklus A.md': 'Jeg er A\n\n![[Syklus B]]',
  'Syklus B.md': 'Jeg er B\n\n![[Syklus A]]',
  'Kafka.md': '---\naliases: [Apache Kafka]\n---\n# Kafka\n## Partisjoner\nDel.\n### Antall\nSeks.\n## Offset\nEn offset. ^offset-def',
  'Selv.md': '![[Selv]]\n\n![[#Annen]]\n\n## Annen\nAndre.',
  'Dyp 1.md': '![[Dyp 2]]',
  'Dyp 2.md': '![[Dyp 3]]',
  'Dyp 3.md': '![[Dyp 4]]',
  'Dyp 4.md': '![[Dyp 5]]',
  'Dyp 5.md': '![[Dyp 6]]',
  'Dyp 6.md': '![[Dyp 7]]',
  'Dyp 7.md': 'Bunn',
  'Bilder.md': '![[logo.svg|Logo|120]]\n\n![Rel](attachments/logo.svg)\n\n![[mangler.png]]\n\n![[Oppgaver.base#Kanban]]\n\n![[Tegning.canvas]]\n\n```base\nviews: []\n```',
  'Lenker.md': '[[Kafka#Offset]] [[Apache Kafka]] [[Finnes ikke]] [[#Annen]]\n\n## Annen',
};
const OTHER = ['attachments/logo.svg', 'Oppgaver.base', 'Tegning.canvas'];
const splitBody = (source: string): string => splitFrontmatter(source).body;

function buildVault() {
  const notes = new Map<string, IndexedNote>();
  const files: VaultFile[] = [];
  for (const [path, source] of Object.entries(SOURCES)) {
    const file = { ...describeVaultPath(path), diskPath: path, size: 0, mtimeMs: 0, ctimeMs: 0 };
    files.push(file);
    notes.set(path, { file, meta: extractNoteMeta(source), body: splitBody(source) });
  }
  for (const path of OTHER) files.push({ ...describeVaultPath(path), diskPath: path, size: 0, mtimeMs: 0, ctimeMs: 0 });
  const aliases = new Map([...notes].map(([p, n]) => [p, n.meta.aliases]));
  const renderer = createNoteRenderer({
    vaultId: 'test',
    highlighter,
    links: createLinkResolver(files, aliases),
    getNote: (filePath) => notes.get(filePath) ?? null,
  });
  return { renderer, file: (p: string) => files.find((f) => f.filePath === p)! };
}

const embeds = (root: Root): Element[] => findAll(root, byTag('vr-embed'));

describe('createNoteRenderer – embeds', () => {
  it('syklus A → B → A stoppes (QA-EMB-05)', () => {
    const { renderer, file } = buildVault();
    const all = embeds(renderer.renderNote(file('Syklus A.md')).content);
    expect(all.map((e) => e.properties.dataStatus)).toEqual(['ok', 'cycle']);
    expect(all[0]!.properties).toMatchObject({ dataTarget: 'Syklus B', dataTitle: 'Syklus B' });
  });

  it('fra Embed-test: A → B → stopp', () => {
    const { renderer, file } = buildVault();
    const all = embeds(renderer.renderNote(file('Embed-test.md')).content);
    expect(all.slice(0, 3).map((e) => [e.properties.dataTarget, e.properties.dataStatus])).toEqual([
      ['Syklus A', 'ok'],
      ['Syklus B', 'ok'],
      ['Syklus A', 'cycle'],
    ]);
  });

  it('seksjon og blokk (QA-EMB-02/03)', () => {
    const { renderer, file } = buildVault();
    const all = embeds(renderer.renderNote(file('Embed-test.md')).content);
    const section = all.find((e) => e.properties.dataAnchor === 'partisjoner')!;
    expect(section.properties.dataTitle).toBe('Kafka › Partisjoner');
    expect(textOf(section)).toContain('Seks.');
    expect(textOf(section)).not.toContain('offset');
    const block = all.find((e) => e.properties.dataAnchor === '^offset-def')!;
    expect(textOf(block).trim()).toBe('En offset.');
  });

  it('manglende notat og manglende seksjon gir missing (QA-EMB-08)', () => {
    const { renderer, file } = buildVault();
    const missing = embeds(renderer.renderNote(file('Embed-test.md')).content).filter((e) => e.properties.dataStatus === 'missing');
    expect(missing.map((e) => e.properties.dataRaw)).toEqual(['![[Finnes ikke]]', '![[Kafka#Finnes ikke]]']);
  });

  it('selv-embed er syklus, annen seksjon i samme notat er lov (QA-EMB-06)', () => {
    const { renderer, file } = buildVault();
    const all = embeds(renderer.renderNote(file('Selv.md')).content);
    expect(all.map((e) => e.properties.dataStatus)).toEqual(['cycle', 'ok']);
  });

  it('maks dybde 5 (PO-15)', () => {
    const { renderer, file } = buildVault();
    const all = embeds(renderer.renderNote(file('Dyp 1.md')).content);
    expect(all.map((e) => e.properties.dataStatus)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'depth-limit']);
  });

  it('bilder, base, canvas og inline-base', () => {
    const { renderer, file } = buildVault();
    const result = renderer.renderNote(file('Bilder.md'));
    const imgs = findAll(result.content, byTag('img'));
    expect(imgs[0]!.properties).toMatchObject({
      src: '/api/vaults/test/assets?path=attachments%2Flogo.svg',
      alt: 'Logo',
      width: 120,
    });
    expect(imgs[1]!.properties).toMatchObject({ alt: 'Rel' });
    expect(embeds(result.content)[0]!.properties).toMatchObject({ dataStatus: 'missing', dataRaw: '![[mangler.png]]' });
    const bases = findAll(result.content, byTag('vr-base'));
    expect(bases.map((b) => b.properties)).toEqual([
      { dataBaseId: 'base-1', dataSourcePath: 'Oppgaver.base', dataView: 'Kanban' },
      { dataBaseId: 'base-2' },
    ]);
    expect(result.bases).toEqual({
      'base-1': { kind: 'file', filePath: 'Oppgaver.base', view: 'Kanban' },
      'base-2': { kind: 'inline', source: 'views: []', hostFilePath: 'Bilder.md' },
    });
    expect(findAll(result.content, byTag('vr-unsupported'))[0]!.properties).toMatchObject({ dataKind: 'canvas', dataTarget: 'Tegning.canvas' });
  });
});

describe('createNoteRenderer – lenker', () => {
  it('ankre, aliasforslag og lokale lenker', () => {
    const { renderer, file } = buildVault();
    const links = findAll(renderer.renderNote(file('Lenker.md')).content, byTag('a'));
    expect(links[0]!.properties).toMatchObject({ dataVrLink: 'internal', dataVrTarget: 'Kafka', dataVrAnchor: 'offset', href: '/v/test/Kafka#offset' });
    expect(links[1]!.properties).toMatchObject({ dataVrLink: 'unresolved', dataVrSuggestion: 'Kafka' });
    expect(links[2]!.properties).toMatchObject({ dataVrLink: 'unresolved' });
    expect(links[2]!.properties.dataVrSuggestion).toBeUndefined();
    expect(links[3]!.properties).toMatchObject({ dataVrTarget: 'Lenker', dataVrAnchor: 'annen', href: '/v/test/Lenker#annen' });
  });

  it('blokkanker beholder ^ i href', () => {
    const { renderer } = buildVault();
    expect(renderer.documentUrl('a b/Kafka', '^offset-def')).toBe('/v/test/a%20b/Kafka#^offset-def');
  });
});
