import { describe, expect, it } from 'vitest';
import { buildSearchIndex, createSearchIndex, foldDiacritics, SEARCH_BUILD_CHUNK } from './search-index';
import type { SearchDocument } from './search-index';

const DOCS: SearchDocument[] = [
  { path: 'teknisk/Kafka/Kafka-grunnleggende', title: 'Kafka-grunnleggende', kind: 'note', aliases: ['Kafka', 'Apache Kafka'], tags: ['kafka'], text: 'Apache Kafka er en distribuert logg.' },
  { path: 'domene/Ordre', title: 'Ordre', kind: 'note', aliases: ['Bestilling', 'Order'], tags: [], text: 'En ordre er en bestilling av ordrelinjer.' },
  { path: 'domene/Betaling', title: 'Betaling', kind: 'note', aliases: [], tags: ['task/backend'], text: 'Vi bruker idempotensnøkler for å unngå dobbel betaling. '.repeat(10) },
  { path: 'edge/Æøå og mellomrom – særnorsk', title: 'Æøå og mellomrom – særnorsk', kind: 'note', aliases: [], tags: ['Task'], text: 'Norske tegn.' },
  { path: 'domene/Ærendelogg', title: 'Ærendelogg', kind: 'note', aliases: [], tags: [], text: 'Logg.' },
  { path: 'Oppgaver.base', title: 'Oppgaver', kind: 'base', aliases: [], tags: [], text: '' },
];

describe('foldDiacritics', () => {
  it('æ→ae, ø→o/oe, å→a/aa, aksenter fjernes', () => {
    expect(foldDiacritics('Ærendelogg')).toEqual(['aerendelogg']);
    expect(foldDiacritics('øyeblikk')).toEqual(['oyeblikk', 'oeyeblikk']);
    expect(foldDiacritics('Café')).toEqual(['cafe']);
  });
});

describe('createSearchIndex', () => {
  const index = createSearchIndex(DOCS);

  it('tittel med prefiks (QA-SOK-01)', () => {
    const [hit] = index.search('kafka grunn', 20);
    expect(hit).toMatchObject({ path: 'teknisk/Kafka/Kafka-grunnleggende', matchedField: 'title', kind: 'note' });
  });

  it('alias (QA-SOK-02)', () => {
    const [hit] = index.search('Bestilling', 20);
    expect(hit).toMatchObject({ path: 'domene/Ordre', matchedField: 'alias', alias: 'Bestilling' });
  });

  it('særnorske tegn og diakritika-ufølsomt (QA-SOK-03/04)', () => {
    expect(index.search('Særnorsk', 20)[0]!.path).toBe('edge/Æøå og mellomrom – særnorsk');
    expect(index.search('aerendelogg', 20)[0]!.path).toBe('domene/Ærendelogg');
  });

  it('innhold med snippet og uthevinger (QA-SOK-05)', () => {
    const [hit] = index.search('idempotensnøkler', 20);
    expect(hit).toMatchObject({ path: 'domene/Betaling', matchedField: 'content' });
    const [start, end] = hit!.snippet!.highlights[0]!;
    expect(hit!.snippet!.text.slice(start, end).toLowerCase()).toBe('idempotensnøkler');
    expect(hit!.snippet!.text.length).toBeLessThanOrEqual(170);
  });

  it('baser er søkbare på tittel', () => {
    expect(index.search('oppgaver', 20)[0]).toMatchObject({ path: 'Oppgaver.base', kind: 'base' });
  });

  it('#tagg gir notater med taggen inkl. nestede, case-insensitivt', () => {
    expect(index.search('#task', 20).map((h) => h.path).sort()).toEqual(['domene/Betaling', 'edge/Æøå og mellomrom – særnorsk']);
    expect(index.search('#task/backend', 20).map((h) => h.path)).toEqual(['domene/Betaling']);
    expect(index.search('#tas', 20)).toEqual([]);
  });

  it('tom spørring og limit', () => {
    expect(index.search('   ', 20)).toEqual([]);
    expect(index.search('e', 1).length).toBeLessThanOrEqual(1);
  });

  it('oppdatering: fjern og legg til', () => {
    const updated = createSearchIndex(DOCS);
    updated.remove('domene/Ordre');
    expect(updated.search('Bestilling', 20).map((h) => h.path)).not.toContain('domene/Ordre');
    updated.add({ ...DOCS[1]!, aliases: ['Innkjøp'] });
    expect(updated.search('Innkjøp', 20)[0]!.path).toBe('domene/Ordre');
  });
});

describe('buildSearchIndex (i biter)', () => {
  it('gir samme treff som createSearchIndex og gir fra seg event-loopen mellom bitene', async () => {
    const many = Array.from({ length: SEARCH_BUILD_CHUNK * 3 + 7 }, (_, i) => ({ ...DOCS[i % DOCS.length]!, path: `x/${i}` }));
    let yields = 0;
    const chunked = await buildSearchIndex(many, async () => {
      yields++;
    });
    expect(yields).toBe(3);
    const whole = createSearchIndex(many);
    for (const q of ['kafka', 'kunde', '#task']) expect(chunked.search(q, 50)).toEqual(whole.search(q, 50));
  });
});
