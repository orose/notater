import { describe, expect, it } from 'vitest';
import { lookupNote, rankNotes, type NoteCandidate } from './note-lookup';

const note = (docPath: string, title: string, aliases: string[] = [], mtimeMs = 0): NoteCandidate => ({
  docPath,
  filePath: `${docPath}.md`,
  title,
  aliases,
  mtimeMs,
});

const NOTES: NoteCandidate[] = [
  note('presentasjon/Statusmøte uke 45', 'Statusmøte uke 45', ['Status 45'], 3),
  note('presentasjon/Månedsrapport oktober', 'Månedsrapport oktober', [], 5),
  note('rapporter/Kvartalsrapport', 'Kvartalsrapport', [], 4),
  note('rapporter/Årsrapport', 'Årsrapport', [], 2),
  note('lesekomfort/Kafka', 'Kafka', ['Meldingskø'], 1),
];

const noObsidian = () => null;

describe('notatoppslag (ADR-011 §7, AR-3-26)', () => {
  it('1. eksakt sti, med og uten .md, store/små bokstaver og NFD', () => {
    expect(lookupNote(NOTES, 'presentasjon/Statusmøte uke 45', noObsidian)).toEqual({ kind: 'note', docPath: 'presentasjon/Statusmøte uke 45' });
    expect(lookupNote(NOTES, 'presentasjon/statusmøte uke 45.md', noObsidian)).toEqual({ kind: 'note', docPath: 'presentasjon/Statusmøte uke 45' });
    expect(lookupNote(NOTES, 'presentasjon/Statusmøte uke 45'.normalize('NFD'), noObsidian)).toMatchObject({ kind: 'note' });
  });

  it('2. eksakt tittel eller alias', () => {
    expect(lookupNote(NOTES, 'statusmøte uke 45', noObsidian)).toEqual({ kind: 'note', docPath: 'presentasjon/Statusmøte uke 45' });
    expect(lookupNote(NOTES, 'meldingskø', noObsidian)).toEqual({ kind: 'note', docPath: 'lesekomfort/Kafka' });
  });

  it('3. Obsidian-oppløsning av navnet (korteste unike sti)', () => {
    const resolve = (q: string) => (q === 'lesekomfort/kafka-lenke' ? 'lesekomfort/Kafka' : null);
    expect(lookupNote(NOTES, 'lesekomfort/kafka-lenke', resolve)).toEqual({ kind: 'note', docPath: 'lesekomfort/Kafka' });
  });

  it('4. fuzzy: klart beste treff (≥ 1,5 × nummer to) åpnes direkte', () => {
    expect(lookupNote(NOTES, 'statusm', noObsidian)).toEqual({ kind: 'note', docPath: 'presentasjon/Statusmøte uke 45' });
  });

  it('4. fuzzy: flere like gode treff gir notatlisten med søket utfylt', () => {
    expect(lookupNote(NOTES, 'rapport', noObsidian)).toEqual({ kind: 'list', query: 'rapport' });
  });

  it('ingen treff gir «finnes ikke»', () => {
    expect(lookupNote(NOTES, 'xyzzy', noObsidian)).toEqual({ kind: 'none', query: 'xyzzy' });
  });

  it('rangering: tom spørring = nyeste først; ellers fuzzy med treffområder i tittelen', () => {
    expect(rankNotes(NOTES, '').map((r) => r.note.title)).toEqual(['Månedsrapport oktober', 'Kvartalsrapport', 'Statusmøte uke 45', 'Årsrapport', 'Kafka']);
    const ranked = rankNotes(NOTES, 'rapport');
    expect(ranked.map((r) => r.note.title).sort()).toEqual(['Kvartalsrapport', 'Månedsrapport oktober', 'Årsrapport']);
    expect(ranked[0]?.titleRanges.length).toBeGreaterThan(0);
  });

  it('2000 notater: rangering under 10 ms per tast (ADR-011 §7)', () => {
    const many = Array.from({ length: 2000 }, (_, i) => note(`mappe${i % 40}/Notat nummer ${i}`, `Notat nummer ${i}`, [], i));
    const queries = ['n', 'no', 'not', 'nota', 'notat 1', 'notat 19'];
    for (const q of queries) rankNotes(many, q); // oppvarming (JIT)
    const t0 = performance.now();
    for (let round = 0; round < 3; round++) for (const q of queries) rankNotes(many, q);
    expect((performance.now() - t0) / (3 * queries.length)).toBeLessThan(10);
  });
});
