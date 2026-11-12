import { describe, expect, it } from 'vitest';
import { formatSlideId, parseSlideId, transitionSlideId } from './slide-id';

describe('lysbilde-id (ADR-010 §4)', () => {
  it('utelater del 1 og fortsettelse 1', () => {
    expect(formatSlideId('leveranse-a')).toBe('leveranse-a');
    expect(formatSlideId('leveranse-a', 2)).toBe('leveranse-a.del2');
    expect(formatSlideId('leveranse-a', 1, 3)).toBe('leveranse-a.forts3');
    expect(formatSlideId('leveranse-a', 2, 3)).toBe('leveranse-a.del2.forts3');
  });

  it('parse er inversen av format', () => {
    for (const [part, cont] of [
      [1, 1],
      [2, 1],
      [1, 2],
      [12, 10],
    ] as const) {
      expect(parseSlideId(formatSlideId('plan-q1', part, cont))).toEqual({ base: 'plan-q1', part, continuation: cont });
    }
    expect(parseSlideId(transitionSlideId('siden-sist'))).toEqual({ base: 'overgang.siden-sist', part: 1, continuation: 1 });
  });

  it('ugyldige suffiks blir stående i grunn-id-en', () => {
    expect(parseSlideId('x.del1').base).toBe('x.del1');
    expect(parseSlideId('x.forts0').base).toBe('x.forts0');
  });

  it('er URL-trygg for ASCII-slugger', () => {
    const id = formatSlideId('jobbes-med-nå', 2, 2);
    expect(new URLSearchParams({ lysbilde: id }).get('lysbilde')).toBe(id);
    expect(new URLSearchParams({ lysbilde: 'a.del2.forts3' }).toString()).toBe('lysbilde=a.del2.forts3');
  });
});
