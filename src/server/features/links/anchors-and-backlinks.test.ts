import { describe, expect, it } from 'vitest';
import { describeVaultPath, extractNoteMeta } from '../vault-index';
import type { IndexedNote } from '../vault-index';
import { resolveAnchor } from './anchors';
import { buildBacklinkIndex } from './backlinks';
import { createLinkResolver } from './link-resolver';

function note(path: string, source: string): IndexedNote {
  return {
    file: { ...describeVaultPath(path), diskPath: path, size: 0, mtimeMs: 0, ctimeMs: 0 },
    meta: extractNoteMeta(source),
    body: source,
  };
}

describe('resolveAnchor', () => {
  const meta = extractNoteMeta('## Partisjoner\n### Antall partisjoner\nTekst ^offset-def');

  it('overskrift matches case-insensitivt mot tekst og gir slug-id', () => {
    expect(resolveAnchor(meta, 'antall Partisjoner')).toEqual({ id: 'antall-partisjoner', missing: false });
    expect(resolveAnchor(meta, 'Kafka#Partisjoner')).toEqual({ id: 'partisjoner', missing: false });
  });

  it('blokk-id gir ^id', () => {
    expect(resolveAnchor(meta, '^OFFSET-def')).toEqual({ id: '^offset-def', missing: false });
  });

  it('ukjent anker er ikke brutt, men markeres som manglende', () => {
    expect(resolveAnchor(meta, 'Finnes ikke')).toEqual({ id: null, missing: true });
    expect(resolveAnchor(meta, '^nei')).toEqual({ id: null, missing: true });
    expect(resolveAnchor(meta, null)).toEqual({ id: null, missing: false });
  });
});

describe('buildBacklinkIndex', () => {
  const notes = [
    note('domene/Kunde.md', '# Kunde\nSe [[#Kunde]] og [[Kunde]].'),
    note('domene/Ordre.md', '---\nrelatert: ["[[Kunde]]"]\n---\nEn [[Kunde]]s bestilling. Også [[domene/Kunde|kunden]].'),
    note('lenker/Lenketest.md', '[Kunde](../domene/Kunde.md) og ![[Kunde]] og [[Finnes ikke]]'),
    note('edge/Props.md', '---\nlenke: "[[Kunde]]"\n---\n'),
    note('kode.md', '`[[Kunde]]`'),
  ];
  const resolver = createLinkResolver(notes.map((n) => n.file));
  const index = buildBacklinkIndex(notes, resolver);

  it('teller distinkte kilder, inkl. embeds, markdown- og property-lenker; ikke selvlenker', () => {
    const backlinks = index.get('domene/Kunde.md');
    expect(backlinks.map((b) => b.source.filePath)).toEqual(['lenker/Lenketest.md', 'domene/Ordre.md', 'edge/Props.md']);
    expect(backlinks.find((b) => b.source.filePath === 'domene/Ordre.md')).toMatchObject({ count: 3, fromProperty: true });
    expect(backlinks.find((b) => b.source.filePath === 'lenker/Lenketest.md')).toMatchObject({ count: 2, fromProperty: false });
  });

  it('snippet foretrekker brødtekst framfor property', () => {
    const ordre = index.get('domene/Kunde.md').find((b) => b.source.filePath === 'domene/Ordre.md');
    expect(ordre!.snippet).toContain('bestilling');
    const props = index.get('domene/Kunde.md').find((b) => b.source.filePath === 'edge/Props.md');
    expect(props!.snippet).toBe('lenke: [[Kunde]]');
  });

  it('tom liste for filer uten tilbakelenker', () => {
    expect(index.get('kode.md')).toEqual([]);
  });
});
