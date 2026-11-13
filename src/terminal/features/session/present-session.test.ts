import { describe, expect, it } from 'vitest';
import type { NoteDocument } from '../../../shared/api-types';
import statusmote from '../../../core/presentation/model/fixtures/Statusmøte uke 45.json';
import { buildDeck, currentSlide, goTo, levelsOf, rebuild, startPresent, step, toggleBlackout } from './present-session';

const doc = { ...(statusmote as object), kind: 'note', path: 'presentasjon/Statusmøte uke 45', properties: [], aliases: [], bases: {}, mtime: '2026-11-01T10:00:00Z' } as unknown as NoteDocument;
const auto = { level: null, transitions: true } as const;

describe('presentasjonsøkten i terminalen (delt lysbildemodell)', () => {
  it('samme kortstokk som v2-modellen: tittel først, agenda, overganger og innhold', () => {
    const deck = buildDeck(doc, auto);
    expect(deck.slides[0]?.kind).toBe('title');
    expect(deck.slides.map((s) => s.kind)).toContain('agenda');
    expect(deck.slides.map((s) => s.kind)).toContain('transition');
    expect(buildDeck(doc, { level: null, transitions: false }).slides.map((s) => s.kind)).not.toContain('transition');
  });

  it('neste/forrige med grenser; gg/G', () => {
    let s = startPresent(doc, auto);
    expect(s.index).toBe(0);
    expect(step(s, -1)).toBe(s);
    s = step(s, 1);
    expect(s.index).toBe(1);
    const last = goTo(s, 999);
    expect(last.index).toBe(last.deck.slides.length - 1);
    expect(step(last, 1)).toBe(last);
    expect(goTo(last, 0).index).toBe(0);
  });

  it('svart skjerm: neste gir bildet tilbake uten å bla', () => {
    const s = toggleBlackout(step(startPresent(doc, auto), 1));
    expect(s.blackout).toBe(true);
    const back = step(s, 1);
    expect(back.blackout).toBe(false);
    expect(back.index).toBe(1);
  });

  it('nytt nivå og :agenda av beholder lysbildet (resolveSlide)', () => {
    const s = goTo(startPresent(doc, auto), 4);
    const id = currentSlide(s)?.id;
    const without = rebuild(s, { options: { level: null, transitions: false } });
    if (currentSlide(s)?.kind === 'content') expect(currentSlide(without)?.id).toBe(id);
    expect(without.deck.slides.length).toBeLessThan(s.deck.slides.length);
    expect(levelsOf(doc).map((l) => l.level).length).toBeGreaterThan(0);
  });
});
