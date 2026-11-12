import { describe, expect, it } from 'vitest';
import { DEFAULT_MIN_FONT_SCALE, fontScaleSteps } from './fit-types';

describe('skriftskala-trinn (A2, ADR-010 §2)', () => {
  it('fra 1 ned til minimum i steg på 2,5 %, minimum inkludert', () => {
    const steps = fontScaleSteps(0.025, 0.75);
    expect(steps[0]).toBe(1);
    expect(steps.at(-1)).toBe(0.75);
    expect(steps).toHaveLength(11);
    expect([...steps].sort((a, b) => b - a)).toEqual(steps);
  });

  it('minimum som ikke treffer et trinn (Terminal: 28/36 ≈ 0,778) legges til sist', () => {
    expect(fontScaleSteps(0.025, 0.778).slice(-2)).toEqual([0.8, 0.778]);
  });

  it('ugyldige tokenverdier gir reserveverdiene', () => {
    expect(fontScaleSteps(Number.NaN, 2).at(-1)).toBe(DEFAULT_MIN_FONT_SCALE);
    expect(fontScaleSteps(0, 0.9)).toEqual([1, 0.975, 0.95, 0.925, 0.9]);
  });
});
