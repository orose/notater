import { describe, expect, it } from 'vitest';
import { parseObsidianMarkdown } from './parse-markdown';
import { toPlainText } from './plain-text';
import { collectHeadings, extractBlock, extractHeadingSection } from './sections';

const KAFKA = [
  '# Kafka',
  '## Partisjoner',
  'Del i partisjoner.',
  '### Antall partisjoner',
  'Start med 6.',
  '## Offset',
  'En offset er posisjonen. ^offset-def',
  '',
  '- Auto-commit. ^liste-blokk',
  '- Manuell commit.',
].join('\n');

describe('collectHeadings', () => {
  it('gir dybde, ren tekst og unike slugs', () => {
    const tree = parseObsidianMarkdown('## Oppsummering\n## `kode` og **fet** [[Lenke|alias]]\n## Oppsummering');
    expect(collectHeadings(tree)).toEqual([
      { depth: 2, text: 'Oppsummering', id: 'oppsummering' },
      { depth: 2, text: 'kode og fet alias', id: 'kode-og-fet-alias' },
      { depth: 2, text: 'Oppsummering', id: 'oppsummering-1' },
    ]);
  });

  it('setter vrHeadingId på nodene', () => {
    const tree = parseObsidianMarkdown('## Kom i gang');
    collectHeadings(tree);
    expect(tree.children[0]!.data?.vrHeadingId).toBe('kom-i-gang');
  });
});

describe('extractHeadingSection', () => {
  it('tar med underseksjoner, stopper ved samme eller høyere nivå (QA-EMB-02)', () => {
    const tree = parseObsidianMarkdown(KAFKA);
    collectHeadings(tree);
    const section = extractHeadingSection(tree, 'partisjoner');
    const text = toPlainText(section!);
    expect(text).toContain('Antall partisjoner');
    expect(text).not.toContain('offset');
  });

  it('null for ukjent overskrift', () => {
    const tree = parseObsidianMarkdown(KAFKA);
    collectHeadings(tree);
    expect(extractHeadingSection(tree, 'finnes-ikke')).toBeNull();
  });
});

describe('extractBlock', () => {
  it('avsnitt med blokk-id', () => {
    const block = extractBlock(parseObsidianMarkdown(KAFKA), 'offset-def');
    expect(toPlainText(block!)).toBe('En offset er posisjonen.');
  });

  it('listepunkt pakkes i en liste med bare det punktet', () => {
    const block = extractBlock(parseObsidianMarkdown(KAFKA), 'LISTE-BLOKK');
    expect(block!.children[0]!.type).toBe('list');
    expect(toPlainText(block!)).toBe('Auto-commit.');
  });

  it('null for ukjent blokk', () => {
    expect(extractBlock(parseObsidianMarkdown(KAFKA), 'nei')).toBeNull();
  });
});
