import { describe, expect, it } from 'vitest';
import { railOverlapped } from './rail-overlap';

const rail = { top: 72, bottom: 400, left: 1188, right: 1404 };

describe('railOverlapped (PO-48)', () => {
  it('sann når en bred blokk dekker margsonen vertikalt og horisontalt', () => {
    expect(railOverlapped(rail, [{ top: 300, bottom: 900, left: 316, right: 1404 }])).toBe(true);
  });
  it('usann når blokken er over eller under margen', () => {
    expect(railOverlapped(rail, [{ top: 420, bottom: 900, left: 316, right: 1404 }])).toBe(false);
    expect(railOverlapped(rail, [{ top: -600, bottom: 60, left: 316, right: 1404 }])).toBe(false);
  });
  it('usann når blokken ikke når inn i margen (smal skjerm / vanlig bredde)', () => {
    expect(railOverlapped(rail, [{ top: 100, bottom: 900, left: 316, right: 925 }])).toBe(false);
  });
  it('usann uten margen (skjult rail har null-størrelse)', () => {
    expect(railOverlapped({ top: 0, bottom: 0, left: 0, right: 0 }, [{ top: 0, bottom: 900, left: 0, right: 1400 }])).toBe(false);
  });
});
