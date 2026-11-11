import { describe, expect, it } from 'vitest';
import { resolveSlide, type Locatable } from './resolve-slide';
import type { SlideAddress } from './slide-types';

const at = (kind: SlideAddress['kind'], agenda: number | null, slide: number, part = 1, continuation = 1): SlideAddress => ({
  kind,
  agenda,
  slide,
  part,
  continuation,
});

const deck = (...slides: Array<[string, SlideAddress]>): Locatable[] => slides.map(([id, address]) => ({ id, address }));

const before = deck(
  ['tittel', at('title', null, 0)],
  ['agenda', at('agenda', null, 0)],
  ['overgang.siden-sist', at('transition', 0, 0)],
  ['leveranse-a', at('content', 0, 0)],
  ['leveranse-b', at('content', 0, 1)],
  ['leveranse-b.forts2', at('content', 0, 1, 1, 2)],
  ['overgang.jobbes-med-na', at('transition', 1, 0)],
  ['oppgaver', at('content', 1, 0)],
);

describe('resolveSlide (ADR-010 §5)', () => {
  it('eksakt id', () => {
    expect(resolveSlide(before, 'oppgaver', before)).toEqual({ index: 7, reason: 'exact' });
  });

  it('færre fortsettelser etter ny tilpasning: faller til grunn-id', () => {
    const after = before.filter((s) => s.id !== 'leveranse-b.forts2');
    expect(resolveSlide(after, 'leveranse-b.forts2', before)).toEqual({ index: 4, reason: 'base' });
  });

  it('AK-2-07: omdøpt agendaoverskrift – overgangen finnes på samme adresse', () => {
    const after = before.map((s) => (s.id === 'overgang.jobbes-med-na' ? { ...s, id: 'overgang.pagaende' } : s));
    expect(resolveSlide(after, 'overgang.jobbes-med-na', before)).toEqual({ index: 6, reason: 'address' });
  });

  it('slettet lysbilde: nærmeste etterfølger som finnes, ellers forgjenger', () => {
    const noA = deck(...before.filter((s) => !s.id.startsWith('leveranse-')).map((s) => [s.id, s.address] as [string, SlideAddress]));
    expect(resolveSlide(noA, 'leveranse-a', before)).toEqual({ index: 3, reason: 'neighbour' });
    const noTail = before.slice(0, 7);
    expect(resolveSlide(noTail, 'oppgaver', before)).toEqual({ index: 6, reason: 'neighbour' });
  });

  it('ukjent id uten forrige kortstokk: første lysbilde; tom kortstokk: -1', () => {
    expect(resolveSlide(before, 'finnes-ikke')).toEqual({ index: 0, reason: 'clamped' });
    expect(resolveSlide([], 'tittel')).toEqual({ index: -1, reason: 'empty' });
  });
});
