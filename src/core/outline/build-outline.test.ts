import type { Element, Root } from 'hast';
import { describe, expect, it } from 'vitest';
import { buildOutline, hiddenBlocks } from './build-outline';

const h = (level: number, id: string, text: string): Element => ({
  type: 'element',
  tagName: `h${level}`,
  properties: { id },
  children: [{ type: 'text', value: text }],
});
const p = (text: string, id?: string): Element => ({ type: 'element', tagName: 'p', properties: id ? { id } : {}, children: [{ type: 'text', value: text }] });
const nl = { type: 'text' as const, value: '\n' };

// Dyp struktur (test-vault/lesekomfort/Dyp struktur.md) i forenklet form.
const content: Root = {
  type: 'root',
  children: [
    p('Intro før første overskrift.'), // 0
    nl, // 1
    h(2, 'a', 'Seksjon A'), // 2
    p('Markør A-2.'), // 3
    h(3, 'a1', 'Seksjon A.1'), // 4
    p('Markør A-3.'), // 5
    h(6, 'n6', 'Nivå 6'), // 6
    p('Bunnavsnittet.', '^dyp-blokk'), // 7
    h(3, 'a2', 'Seksjon A.2'), // 8
    { type: 'element', tagName: 'vr-code', properties: {}, children: [{ type: 'text', value: 'kode her ikke ord' }] }, // 9
    h(2, 'b', 'Seksjon B'), // 10
    p('Markør B-2.'), // 11
    h(1, 'andre', 'Andre del'), // 12
    h(2, 'c', 'Seksjon C'), // 13
    p('Markør C-2.'), // 14
    { type: 'element', tagName: 'vr-footnotes', properties: {}, children: [p('Fotnote.')] }, // 15
  ],
};

const outline = buildOutline(content, [{ depth: 2, id: 'a', text: 'Seksjon A (fra toc)' }]);

describe('buildOutline (ADR-009, F3)', () => {
  it('finner toppnivå-overskriftene; teksten fra toc der den finnes', () => {
    expect(outline.headings.map((x) => [x.id, x.level, x.text])).toEqual([
      ['a', 2, 'Seksjon A (fra toc)'],
      ['a1', 3, 'Seksjon A.1'],
      ['n6', 6, 'Nivå 6'],
      ['a2', 3, 'Seksjon A.2'],
      ['b', 2, 'Seksjon B'],
      ['andre', 1, 'Andre del'],
      ['c', 2, 'Seksjon C'],
    ]);
  });

  it('seksjon løper til neste overskrift på samme eller høyere nivå, aldri inn i fotnotene', () => {
    expect(outline.sectionRange('a')).toEqual([3, 10]);
    expect(outline.sectionRange('a1')).toEqual([5, 8]);
    expect(outline.sectionRange('n6')).toEqual([7, 8]);
    expect(outline.sectionRange('b')).toEqual([11, 12]);
    expect(outline.sectionRange('andre')).toEqual([13, 15]);
    expect(outline.sectionRange('c')).toEqual([14, 15]);
  });

  it('§-nummer på toppnivå-H2 (data-vr-sec), uten å mutere input', () => {
    const secs = outline.content.children.flatMap((n) => (n.type === 'element' && n.properties.dataVrSec ? [[n.properties.id, n.properties.dataVrSec, n.properties.dataVrSecPad]] : []));
    expect(secs).toEqual([
      ['a', '1', '01'],
      ['b', '2', '02'],
      ['c', '3', '03'],
    ]);
    expect(outline.headings.filter((x) => x.sec !== null).map((x) => x.sec)).toEqual([1, 2, 3]);
    expect((content.children[2] as Element).properties.dataVrSec).toBeUndefined();
    expect(outline.content.children[3]).toBe(content.children[3]);
  });

  it('sectionOf: alle seksjoner som inneholder målet, og overskriften selv', () => {
    expect(outline.sectionOf('^dyp-blokk')).toEqual(['a', 'a1', 'n6']);
    expect(outline.sectionOf('n6')).toEqual(['a', 'a1', 'n6']);
    expect(outline.sectionOf('finnes-ikke')).toEqual([]);
  });

  it('hiddenBlocks er unionen av foldede seksjoner', () => {
    expect([...hiddenBlocks(outline, new Set(['a1', 'b']))].sort((x, y) => x - y)).toEqual([5, 6, 7, 11]);
    expect(hiddenBlocks(outline, new Set()).size).toBe(0);
  });

  it('flow: toppnivåflyten uten blanke tekstnoder og fotnoter, med overskrifter og skiller (ADR-010 §8)', () => {
    const withHr = buildOutline({ ...content, children: [...content.children.slice(0, 4), { type: 'element', tagName: 'hr', properties: {}, children: [] }, ...content.children.slice(4)] }, []);
    expect(withHr.flow.map((b) => (b.node.type === 'element' ? b.node.tagName : b.node.type))).toEqual(['p', 'h2', 'p', 'hr', 'h3', 'p', 'h6', 'p', 'h3', 'vr-code', 'h2', 'p', 'h1', 'h2', 'p']);
    expect(withHr.flow.filter((b) => b.thematicBreak)).toHaveLength(1);
    expect(withHr.flow[1]?.heading).toEqual({ id: 'a', level: 2, text: 'Seksjon A' });
    expect(withHr.flow[0]?.heading).toBeNull();
  });

  it('teller ord og figurer i seksjonen (fold-linjen)', () => {
    expect(outline.stats('a2')).toEqual({ words: 0, figures: 1 });
    expect(outline.stats('b')).toEqual({ words: 2, figures: 0 });
  });
});
