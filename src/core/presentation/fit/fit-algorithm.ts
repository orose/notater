// A2-algoritmen (ADR-010 §2, designsystem §12.7) som ren funksjon over målt geometri. DOM-delen (`measure-dom.ts`)
// leverer `Geometry` for en skala; her velges skala og bruddpunkter. Testes uten DOM.

import type { DraftFit, UnitOverflow } from '../model';

/** Målt layout av ett utkast ved én skala. Posisjoner er relative til innholdsflatens topp (logiske px). */
export interface Geometry {
  /** Høyden innholdsflaten har til rådighet. */
  readonly available: number;
  /** Alt får plass i høyde og bredde. */
  readonly fits: boolean;
  /** Enhetenes topp/bunn i rekkefølge. */
  readonly units: ReadonlyArray<{ readonly top: number; readonly bottom: number }>;
}

export interface FitInput {
  /** Mål utkastet ved skalaen (setter `--slide-fit` og leser layout). */
  readonly measure: (scale: number) => Geometry;
  /** `fontScaleSteps(...)`: synkende, siste er minimum. */
  readonly steps: readonly number[];
  readonly overflow: readonly UnitOverflow[];
}

interface Packing {
  readonly breaks: number[];
  readonly scrollUnits: number[];
  /** Enheter som er for store også alene (rulling er siste utvei, minste skrift). */
  readonly oversized: number;
}

/** En for stor blokk blir stående på lysbildet hvis minst så mye av høyden er ledig (PO-93, §12.7.3). */
export const ORPHAN_ROOM = 1 / 3;

/**
 * Grådig pakking mellom enheter (A2). En enhet som alene er høyere enn lysbildet, får intern rulling. Ingen
 * foreldreløse lysbilder (PO-93, designsystem §12.7.3): blokken flyttes ikke, men fyller resten av lysbildet – med
 * mindre det er mindre enn en tredjedel ledig; da deles det mellom blokkene (Q-21). Bilder og diagram (`scale`)
 * skaleres i stedet.
 */
export function packUnits(g: Geometry, overflow: readonly UnitOverflow[]): Packing {
  const breaks: number[] = [];
  const scrollUnits: number[] = [];
  const H = g.available + 1;
  let start = 0;
  let oversized = 0;
  const keepScrolling = (i: number) => {
    scrollUnits.push(i);
    if (i + 1 < g.units.length) breaks.push(i + 1);
    start = i + 1;
  };
  g.units.forEach((u, i) => {
    const alone = u.bottom - u.top;
    const used = i > start ? u.top - (g.units[start]?.top ?? u.top) : 0;
    const roomy = H - used >= H * ORPHAN_ROOM;
    if (alone > H && overflow[i] !== 'scale') {
      oversized += 1;
      if (i > start && !roomy) breaks.push(i);
      keepScrolling(i);
      return;
    }
    const first = g.units[start];
    if (i > start && first && u.bottom - first.top > H) {
      // PO-93: det som står før er kort, og blokken (kode, tabell, base …) kan rulle – den blir stående.
      if (overflow[i] === 'scroll' && used < H * ORPHAN_ROOM) {
        keepScrolling(i);
        return;
      }
      breaks.push(i);
      start = i;
    }
  });
  widowRule(g, breaks, scrollUnits);
  return { breaks, scrollUnits, oversized };
}

/** Siste del lavere enn denne andelen av høyden er en «enke» (PO-115). */
export const WIDOW_ROOM = 1 / 4;

/**
 * Enkeregelen (PO-115, designsystem-terminal §2.6.4): blir siste del lavere enn ¼ av høyden, flyttes blokken foran
 * over til den – bare hvis delen foran fortsatt er minst ¼, begge får plass og ingen av dem ruller. Endrer `breaks`.
 */
function widowRule(g: Geometry, breaks: number[], scrollUnits: readonly number[]): void {
  const last = breaks.at(-1);
  if (last === undefined) return;
  const H = g.available + 1;
  const height = (from: number, to: number) => (g.units[to - 1]?.bottom ?? 0) - (g.units[from]?.top ?? 0);
  const end = g.units.length;
  const prevStart = breaks.at(-2) ?? 0;
  const moved = last - 1;
  if (moved <= prevStart) return;
  if (scrollUnits.some((i) => i >= prevStart)) return;
  if (height(last, end) >= H * WIDOW_ROOM) return;
  if (height(prevStart, moved) < H * WIDOW_ROOM || height(moved, end) > H) return;
  breaks[breaks.length - 1] = moved;
}

/** Største skala (lavest indeks) i `[lo, hi]` der `ok` er sann, gitt at `ok(hi)` er sann og `ok` er monoton. */
function largest(lo: number, hi: number, ok: (i: number) => boolean): number {
  let best = hi;
  let a = lo;
  let b = hi - 1;
  while (a <= b) {
    const mid = (a + b) >> 1;
    if (ok(mid)) {
      best = mid;
      b = mid - 1;
    } else {
      a = mid + 1;
    }
  }
  return best;
}

/**
 * 1. Passer det ved skala 1: ferdig. 2. Krymp i trinn (binærsøk) til det passer. 3. Passer ikke minimum: del mellom
 * enheter på minimum, og bruk den største skalaen som gir like mange deler. Alle deler har samme skala. 4. En enhet
 * som er for stor alene, får minimum skrift og intern rulling.
 */
export function fitDraft({ measure, steps, overflow }: FitInput): DraftFit {
  const last = steps.length - 1;
  const at = new Map<number, Geometry>();
  const geo = (i: number): Geometry => {
    let g = at.get(i);
    if (!g) {
      g = measure(steps[i] as number);
      at.set(i, g);
    }
    return g;
  };
  const result = (i: number, p: Packing): DraftFit => ({ scale: steps[i] as number, breaks: p.breaks, scrollUnits: p.scrollUnits });
  if (geo(0).fits) return { scale: steps[0] as number, breaks: [], scrollUnits: [] };
  if (geo(last).fits) {
    const i = largest(1, last, (k) => geo(k).fits);
    return { scale: steps[i] as number, breaks: [], scrollUnits: [] };
  }
  const atMin = packUnits(geo(last), overflow);
  // En blokk som er for stor alene: minste skrift og intern rulling (siste utvei).
  if (atMin.oversized > 0) return result(last, atMin);
  const same = (p: Packing) => p.oversized === 0 && p.breaks.length === atMin.breaks.length && p.scrollUnits.length === atMin.scrollUnits.length;
  const i = largest(0, last, (k) => same(packUnits(geo(k), overflow)));
  return result(i, packUnits(geo(i), overflow));
}
