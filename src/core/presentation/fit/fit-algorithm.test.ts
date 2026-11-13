import { describe, expect, it } from 'vitest';
import type { UnitOverflow } from '../model';
import { fitDraft, packUnits, type Geometry } from './fit-algorithm';
import { fontScaleSteps } from './fit-types';

/** Enhetshøyder ved skala 1; tekst krymper lineært med skalaen. Lerretet har 800 px. */
function fake(heights: readonly number[], available = 800, gap = 20) {
  const calls: number[] = [];
  const measure = (scale: number): Geometry => {
    calls.push(scale);
    let y = 0;
    const units = heights.map((h) => {
      const top = y;
      y += h * scale;
      const unit = { top, bottom: y };
      y += gap * scale;
      return unit;
    });
    const total = units.length ? (units[units.length - 1] as { bottom: number }).bottom : 0;
    return { available, fits: total <= available, units };
  };
  return { measure, calls };
}

const steps = fontScaleSteps(0.025, 0.75);
const flow = (n: number): UnitOverflow[] => Array.from({ length: n }, () => 'flow');

describe('A2-tilpasning (ADR-010 §2, §12.7)', () => {
  it('passer ved skala 1: ett mål, ingen brudd', () => {
    const f = fake([200, 200]);
    expect(fitDraft({ measure: f.measure, steps, overflow: flow(2) })).toEqual({ scale: 1, breaks: [], scrollUnits: [] });
    expect(f.calls).toEqual([1]);
  });

  it('krymper til største trinn som passer (få pass)', () => {
    const f = fake([300, 300, 300]); // 900 + 40 ved 1
    const fit = fitDraft({ measure: f.measure, steps, overflow: flow(3) });
    expect(fit.breaks).toEqual([]);
    expect(fit.scale).toBe(0.85);
    expect(f.calls.length).toBeLessThanOrEqual(6);
  });

  it('passer ikke på minimum: deler mellom enheter, største skala som gir like mange deler', () => {
    const f = fake(Array.from({ length: 10 }, () => 200));
    const fit = fitDraft({ measure: f.measure, steps, overflow: flow(10) });
    expect(fit.scrollUnits).toEqual([]);
    expect(fit.breaks.length).toBe(2);
    expect(fit.scale).toBeGreaterThan(0.75);
  });

  it('ingen foreldreløse lysbilder (PO-93): kort tekst + for stor blokk på samme lysbilde, blokken ruller', () => {
    const f = fake([100, 2000, 100]);
    const fit = fitDraft({ measure: f.measure, steps, overflow: ['flow', 'scroll', 'flow'] });
    expect(fit).toEqual({ scale: 0.75, breaks: [2], scrollUnits: [1] });
  });

  it('PO-93: kort tekst + blokk som ikke får plass etter teksten (men alene): ingen foreldreløs del, blokken ruller', () => {
    const f = fake([300, 760]);
    const fit = fitDraft({ measure: f.measure, steps, overflow: ['flow', 'scroll'] });
    expect(fit).toEqual({ scale: 0.825, breaks: [], scrollUnits: [1] });
  });

  it('mindre enn en tredjedel ledig: den for store blokken får eget lysbilde (Q-21)', () => {
    const f = fake([400, 400, 2000]);
    const fit = fitDraft({ measure: f.measure, steps, overflow: ['flow', 'flow', 'scroll'] });
    expect(fit).toEqual({ scale: 0.75, breaks: [2], scrollUnits: [2] });
  });

  it('en for stor blokk alene på lysbildet: ingen deling, bare rulling', () => {
    const f = fake([2000]);
    expect(fitDraft({ measure: f.measure, steps, overflow: ['scroll'] })).toEqual({ scale: 0.75, breaks: [], scrollUnits: [0] });
  });

  it('bilder/diagram (scale) rulles aldri', () => {
    const g: Geometry = { available: 800, fits: false, units: [{ top: 0, bottom: 1200 }] };
    expect(packUnits(g, ['scale'])).toEqual({ breaks: [], scrollUnits: [], oversized: 0 });
  });

  describe('enkeregelen (PO-115, designsystem-terminal §2.6.4)', () => {
    const geo = (heights: readonly number[], available = 800, gap = 20): Geometry => fake(heights, available, gap).measure(1);

    it('siste del lavere enn ¼: blokken foran flyttes over når delen foran beholder minst ¼ og begge får plass', () => {
      expect(packUnits(geo([380, 380, 60]), flow(3)).breaks).toEqual([1]);
    });

    it('delen foran ville blitt tom eller lavere enn ¼: ingen flytting', () => {
      expect(packUnits(geo([790, 60]), flow(2)).breaks).toEqual([1]);
      expect(packUnits(geo([150, 600, 60]), flow(3)).breaks).toEqual([2]);
    });

    it('får ikke de to blokkene plass sammen: ingen flytting', () => {
      expect(packUnits(geo([100, 680, 150]), flow(3)).breaks).toEqual([2]);
    });

    it('siste del på minst ¼ eller en rullende blokk: uendret', () => {
      expect(packUnits(geo([380, 380, 300]), flow(3)).breaks).toEqual([2]);
      expect(packUnits(geo([380, 2000, 60]), ['flow', 'scroll', 'flow']).breaks).toEqual([2]);
    });
  });
});
