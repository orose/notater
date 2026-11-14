// Automatisk tilpasning (A2, ADR-010 §2): typer og konstanter. Måleren (`MeasureCanvas`, slice 2-b) rendrer
// utkastene i et skjult målelerret med samme komponenter og CSS som visningen, og leverer `DraftFit` per utkast.

import type { DeckFit, DraftFit } from '../model';

/**
 * Tilpasningstrinnet og minimumet eies av UX og leses fra CSS per typesett ved måling:
 * `--slide-fit-step` og `--slide-text-min-lp / --slide-body-lp` (designsystemets tokens). Disse er reserveverdier.
 */
export const DEFAULT_FIT_STEP = 0.025;
export const DEFAULT_MIN_FONT_SCALE = 0.75;

/**
 * Skriftskala-trinn fra 1 ned til `min` (inkludert) i steg på `step`, høyest først. Diskrete trinn gir deterministisk
 * resultat og gode cachetreff; binærsøk over dem holder antall målepass lavt (17 trinn ⇒ ≤ 5 pass).
 */
export function fontScaleSteps(step = DEFAULT_FIT_STEP, min = DEFAULT_MIN_FONT_SCALE): readonly number[] {
  const safeStep = Number.isFinite(step) && step > 0 && step < 1 ? step : DEFAULT_FIT_STEP;
  const safeMin = Number.isFinite(min) && min > 0 && min <= 1 ? min : DEFAULT_MIN_FONT_SCALE;
  const steps: number[] = [];
  for (let i = 0; ; i++) {
    const value = Math.round((1 - i * safeStep) * 1000) / 1000;
    if (value <= safeMin + 1e-9) break;
    steps.push(value);
  }
  steps.push(Math.round(safeMin * 1000) / 1000);
  return steps;
}

/** Utkast som ikke er målt ennå, vises med standardskala og uten brudd (foreløpig). */
export const UNMEASURED: DraftFit = { scale: 1, breaks: [], scrollUnits: [] };

/**
 * Cachenøkkel: innholdet (fingeravtrykk av enhetene og basedataene de viser) + det som påvirker layout.
 * Lys/mørk og palett påvirker ikke layout og er ikke med; vindusstørrelsen heller ikke (logisk lerret).
 */
export interface FitKey {
  /** Hash av utkastets enheter (HAST som JSON), overskrift, og `BaseResult`-ene enhetene viser. */
  readonly content: string;
  /** `data-type` (typesett) – fontmetrikk og typesettets tilpasningsminimum. */
  readonly typeset: string;
  /** Øk når lysbilde-CSS-en endrer seg på en måte som påvirker layout (byggkonstant). */
  readonly layoutVersion: number;
}

export interface FitCache {
  get(key: FitKey): DraftFit | undefined;
  set(key: FitKey, fit: DraftFit): void;
  /** Fontene ble lastet på nytt (`document.fonts` `loadingdone`) e.l.: alt måles på nytt. */
  clear(): void;
}

/** Hvor langt tilpasningen er kommet (prioritet: start-lysbildet og naboene først). */
export type FitProgress = Pick<DeckFit, 'complete'> & { readonly measured: number; readonly total: number };
