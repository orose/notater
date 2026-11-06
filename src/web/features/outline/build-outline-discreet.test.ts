import type { Element, ElementContent, Root } from 'hast';
import { describe, expect, it } from 'vitest';
import { buildOutline } from './build-outline';

const h = (level: number, text: string, id?: string): Element => ({
  type: 'element',
  tagName: `h${level}`,
  properties: id ? { id } : {},
  children: [{ type: 'text', value: text }],
});
const p = (text: string, id?: string): Element => ({ type: 'element', tagName: 'p', properties: id ? { id } : {}, children: [{ type: 'text', value: text }] });
const embed = (title: string, children: ElementContent[], anchor?: string, status = 'ok'): Element => ({
  type: 'element',
  tagName: 'vr-embed',
  properties: { dataStatus: status, dataTarget: `kilder/${title}`, dataTitle: title, ...(anchor ? { dataAnchor: anchor } : {}) },
  children,
});

// Kvartalsrapporten (test-vault/lesekomfort/Kvartalsrapport.md) i forenklet form, slik serveren sender den.
const rapport: Root = {
  type: 'root',
  children: [
    p('Innledning.'),
    embed('Sammendrag', [p('Kvartalet ble levert.'), h(2, 'Funn'), p('Driften var stabil.'), h(2, 'Konklusjon'), p('Samme kurs.')]),
    h(1, 'Del I – Drift', 'del-i'),
    embed('Driftsstatus', [h(1, 'Driftsstatus'), p('Driften i kvartalet var stabil.'), h(2, 'Hendelser'), h(3, 'Nattlige jobber'), p('Én jobb feilet.'), h(2, 'Kapasitet'), p('Tilstrekkelig.')]),
    h(2, 'Nøkkeltall', 'nokkeltall'),
    embed('Driftsstatus › Kapasitet', [h(2, 'Kapasitet'), p('Tilstrekkelig.'), h(3, 'Lagring'), p('61 prosent.')], 'kapasitet'),
    embed('Driftsstatus', [p('Oppetiden var 99,95 prosent.')], '^oppetid'),
    h(3, 'Detaljer', 'detaljer'),
    embed('Leveranser', [p('Fire leveranser.'), h(2, 'Levert'), h(2, 'Planlagt'), embed('Plan', [p('Stabilitet.'), h(2, 'Steg')])]),
    h(1, 'Del II – Feiltilstander', 'del-ii'),
    embed('Finnes ikke', [], undefined, 'missing'),
    { type: 'element', tagName: 'vr-footnotes', properties: {}, children: [] },
  ],
};

const toc = [
  { depth: 1, id: 'del-i', text: 'Del I – Drift' },
  { depth: 2, id: 'nokkeltall', text: 'Nøkkeltall' },
  { depth: 3, id: 'detaljer', text: 'Detaljer' },
  { depth: 1, id: 'del-ii', text: 'Del II – Feiltilstander' },
];

describe('buildOutline i diskré modus (F2, ADR-009 beslutning 3)', () => {
  const outline = buildOutline(rapport, toc, true);

  it('nivåregel: tittel ett nivå under forrige overskrift (PO-57/58), innhold forskjøvet (PO-65), H1 som tittel (PO-35)', () => {
    expect(outline.headings.map((x) => [x.level, x.text])).toEqual([
      [2, 'Sammendrag'],
      [3, 'Funn'],
      [3, 'Konklusjon'],
      [1, 'Del I – Drift'],
      [2, 'Driftsstatus'],
      [3, 'Hendelser'],
      [4, 'Nattlige jobber'],
      [3, 'Kapasitet'],
      [2, 'Nøkkeltall'],
      [3, 'Kapasitet'],
      [4, 'Lagring'],
      [3, 'Detaljer'],
      [4, 'Leveranser'],
      [5, 'Levert'],
      [5, 'Planlagt'],
      [6, 'Plan'],
      [6, 'Steg'],
      [1, 'Del II – Feiltilstander'],
    ]);
  });

  it('innebygde overskrifter får id ~e<n>-<i> (n i dokumentrekkefølge, tittel = 0)', () => {
    const ids = outline.headings.filter((x) => x.origin === 'embed').map((x) => x.id);
    expect(ids).toEqual(['~e1-0', '~e1-1', '~e1-2', '~e2-0', '~e2-1', '~e2-2', '~e2-3', '~e3-0', '~e3-1', '~e5-0', '~e5-1', '~e5-2', '~e6-0', '~e6-1']);
  });

  it('TOC og §-nummer går sammenhengende gjennom innebygde H2-er', () => {
    expect(outline.toc.map((t) => t.text)).toEqual(outline.headings.map((x) => x.text));
    expect(outline.headings.filter((x) => x.sec !== null).map((x) => [x.sec, x.text])).toEqual([
      [1, 'Sammendrag'],
      [2, 'Driftsstatus'],
      [3, 'Nøkkeltall'],
    ]);
  });

  it('embeds merkes diskré; feilkort røres ikke', () => {
    const embeds = outline.content.children.filter((n): n is Element => n.type === 'element' && n.tagName === 'vr-embed');
    expect(embeds.map((e) => e.properties.dataVrDiscreet ?? null)).toEqual(['true', 'true', 'true', 'true', 'true', null]);
    expect(outline.noteEmbeds).toBe(7);
  });

  it('seksjon slutter ved embedens slutt: fold av «Hendelser» skjuler ikke vertens tekst etter embeden', () => {
    const folded = outline.applyFolds(new Set(['~e2-1']));
    const drift = folded.children[3] as Element;
    const hiddenTexts = drift.children.filter((c): c is Element => c.type === 'element' && c.properties.hidden === true).map((c) => JSON.stringify(c));
    expect(hiddenTexts).toHaveLength(2); // h3 Nattlige jobber + avsnittet
    expect(folded.children[4]).toBe(outline.content.children[4]); // Nøkkeltall urørt
  });

  it('en vertsoverskrift som inneholder embeden, skjuler hele embeden (med kildelenke)', () => {
    const folded = outline.applyFolds(new Set(['del-i']));
    const wrapped = folded.children[3] as Element;
    expect(wrapped.tagName).toBe('div');
    expect(wrapped.properties.hidden).toBe(true);
    expect((wrapped.children[0] as Element).tagName).toBe('vr-embed');
  });

  it('sectionOf finner seksjonene rundt en innebygd overskrift', () => {
    expect(outline.sectionOf('~e2-2')).toEqual(['del-i', '~e2-0', '~e2-1', '~e2-2']);
  });
});

describe('buildOutline i rammet modus (PO-68)', () => {
  it('overskrifter i rammede embeds blir p.embed-title og er ikke i disposisjonen', () => {
    const outline = buildOutline(rapport, toc, false);
    expect(outline.headings.map((x) => x.id)).toEqual(['del-i', 'nokkeltall', 'detaljer', 'del-ii']);
    const drift = outline.content.children[3] as Element;
    expect(drift.children.slice(0, 1)).toEqual([{ type: 'element', tagName: 'p', properties: { className: ['embed-title'] }, children: [{ type: 'text', value: 'Driftsstatus' }] }]);
    expect(outline.toc).toBe(toc);
  });
});
