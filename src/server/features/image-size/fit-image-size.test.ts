import { describe, expect, it } from 'vitest';
import { fitImageSize } from './fit-image-size';

const landscape = { width: 1200, height: 800 };

describe('fitImageSize (PO-71)', () => {
  it('uten ønsket størrelse: bildets egen størrelse', () => {
    expect(fitImageSize(landscape)).toEqual({ width: 1200, height: 800 });
  });

  it('`|300`: høyden følger sideforholdet', () => {
    expect(fitImageSize(landscape, { width: 300 })).toEqual({ width: 300, height: 200 });
    expect(fitImageSize({ width: 3, height: 1 }, { width: 100 })).toEqual({ width: 100, height: 33 });
  });

  it('bare høyde (HTML `height`): bredden følger sideforholdet', () => {
    expect(fitImageSize(landscape, { height: 100 })).toEqual({ width: 150, height: 100 });
  });

  it('`|300x200`: skaleres til å passe inni boksen, sideforholdet bevares', () => {
    expect(fitImageSize(landscape, { width: 300, height: 300 })).toEqual({ width: 300, height: 200 });
    expect(fitImageSize(landscape, { width: 600, height: 100 })).toEqual({ width: 150, height: 100 });
    expect(fitImageSize(landscape, { width: 300, height: 200 })).toEqual({ width: 300, height: 200 });
  });

  it('forstørrer også når boksen er større enn bildet', () => {
    expect(fitImageSize({ width: 10, height: 5 }, { width: 100 })).toEqual({ width: 100, height: 50 });
  });

  it('aldri under 1 px', () => {
    expect(fitImageSize({ width: 10_000, height: 1 }, { width: 10 })).toEqual({ width: 10, height: 1 });
  });

  it('ukjent størrelse: bare det som ble bedt om, uendret', () => {
    expect(fitImageSize(null)).toEqual({});
    expect(fitImageSize(null, { width: 300 })).toEqual({ width: 300 });
    expect(fitImageSize(null, { width: 300, height: 200 })).toEqual({ width: 300, height: 200 });
  });

  it('ugyldige ønsker (0, negative, NaN) ignoreres', () => {
    expect(fitImageSize(landscape, { width: 0, height: Number.NaN })).toEqual({ width: 1200, height: 800 });
    expect(fitImageSize(null, { width: -5 })).toEqual({});
  });
});
