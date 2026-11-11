import { describe, expect, it } from 'vitest';
import { enterPresentationFullscreen } from './fullscreen';
import { SLIDE_PARAM, slideParam, withSlideParam } from './presentation-url';

describe('URL-tilstand (ADR-010 §4)', () => {
  it('skiller «ingen presentasjon», «start ved leseposisjon» og id', () => {
    expect(slideParam('')).toBeNull();
    expect(slideParam(`?${SLIDE_PARAM}=`)).toBe('');
    expect(slideParam(`?${SLIDE_PARAM}=leveranse-b.forts2`)).toBe('leveranse-b.forts2');
  });

  it('setter og fjerner parameteren og beholder andre', () => {
    expect(withSlideParam('', 'tittel')).toBe('?lysbilde=tittel');
    expect(withSlideParam('?type=terminal&lysbilde=agenda', 'plan-q1')).toBe('?type=terminal&lysbilde=plan-q1');
    expect(withSlideParam('?type=terminal&lysbilde=agenda', null)).toBe('?type=terminal');
    expect(withSlideParam('?lysbilde=agenda', null)).toBe('');
    expect(slideParam(withSlideParam('', 'jobbes-med-nå'))).toBe('jobbes-med-nå');
  });
});

describe('fullskjerm (ADR-010 §4)', () => {
  it('uten Fullscreen API går presentasjonen videre i vinduet', async () => {
    expect(await enterPresentationFullscreen(document)).toBe('unsupported');
  });
});

describe('fullskjerm med Fullscreen API (ADR-010 §4)', () => {
  it('avvist forespørsel gir «denied» uten unntak', async () => {
    const doc = { fullscreenElement: null, fullscreenEnabled: true, documentElement: { requestFullscreen: () => Promise.reject(new TypeError('nei')) } } as unknown as Document;
    expect(await enterPresentationFullscreen(doc)).toBe('denied');
  });
  it('innvilget gir «entered»; allerede i fullskjerm gir «already»', async () => {
    const doc = { fullscreenElement: null, fullscreenEnabled: true, documentElement: { requestFullscreen: () => Promise.resolve() } } as unknown as Document;
    expect(await enterPresentationFullscreen(doc)).toBe('entered');
    expect(await enterPresentationFullscreen({ fullscreenElement: {} } as unknown as Document)).toBe('already');
  });
});
