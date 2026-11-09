// Skjult målelerret (ADR-010 §2): rendrer utkastene med samme `SlideView` og CSS som visningen, i logisk størrelse
// uten transform, og måler dem i en layout-effekt. Skalaen prøves ved å sette `--slide-fit` direkte i DOM-en (ingen
// ny React-render per pass). Resultatet går til cachen via `onMeasured`.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { CONTINUED_SUFFIX, footnotesOf, type DraftFit, type Slide, type SlideDraft, type UnitOverflow } from '../model';
import type { MeasureRequest } from '../presentation-context';
import { SlideView, type DeckInfo } from '../SlideView';
import { fitDraft, type Geometry } from './fit-algorithm';
import { DEFAULT_FIT_STEP, DEFAULT_MIN_FONT_SCALE, fontScaleSteps } from './fit-types';

/** Et utkast som lysbilde (alle enheter, alle fotnoter). */
export function draftAsSlide(draft: SlideDraft): Slide {
  return {
    id: draft.baseId,
    kind: draft.kind,
    address: { ...draft.address, continuation: 1 },
    number: 0,
    heading: draft.heading !== null && draft.continued ? `${draft.heading}${CONTINUED_SUFFIX}` : draft.heading,
    units: draft.units,
    scale: 1,
    scrollUnits: [],
    footnotes: footnotesOf(draft.units),
    agendaIndex: draft.address.agenda,
    progress: null,
    withPreamble: false,
    label: '',
    sourceHeadingIds: [],
  };
}

/** Lange agendaer krympes ned mot `--slide-step-1` (designsystem §12.4). */
const AGENDA_MIN_SCALE = 0.55;
const SAFETY_PX = 4;

function cssNumber(el: Element, name: string, fallback: number): number {
  const v = parseFloat(getComputedStyle(el).getPropertyValue(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Bredden flyter over (lange kodelinjer, brede tabeller): teller som «får ikke plass» (§12.7.1). */
function overflowsWidth(box: HTMLElement): boolean {
  if (box.scrollWidth > box.clientWidth + 1) return true;
  for (const el of box.querySelectorAll<HTMLElement>('pre, .table-wrap')) if (el.scrollWidth > el.clientWidth + 1) return true;
  return false;
}

/** Leser geometrien til innholdsflaten ved skala `scale`. */
export function measureBox(slide: HTMLElement, box: HTMLElement, scale: number): Geometry {
  slide.style.setProperty('--slide-fit', String(scale));
  const available = box.clientHeight;
  // Naturlig høyde: flaten klappes sammen et øyeblikk, så scrollHeight er innholdets fulle utstrekning (også det som
  // stikker ut av barna), uavhengig av flex/1fr som ellers fyller flaten.
  const { flex, height, minHeight } = box.style;
  box.style.flex = 'none';
  box.style.height = '0px';
  box.style.minHeight = '0px';
  const extent = box.scrollHeight;
  const units = [...box.querySelectorAll<HTMLElement>('[data-unit]')]
    .sort((a, b) => Number(a.dataset.unit) - Number(b.dataset.unit))
    .map((el) => ({ top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight }));
  const wide = overflowsWidth(box);
  box.style.flex = flex;
  box.style.height = height;
  box.style.minHeight = minHeight;
  // Liten sikkerhetsmargin: avrunding i tekstlayout kan skille et par piksler mellom målelerret og visning.
  return { available: available - SAFETY_PX, fits: extent <= available - SAFETY_PX && !wide, units };
}

/** Største trinn som får plass (binærsøk); ellers minimum. Agenda og tittel deles aldri. */
function shrinkOnly(el: HTMLElement, box: HTMLElement, steps: readonly number[]): number {
  const fits = (i: number) => measureBox(el, box, steps[i] as number).fits;
  if (fits(0)) return steps[0] as number;
  let lo = 1;
  let hi = steps.length - 1;
  if (!fits(hi)) return steps[hi] as number;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (fits(mid)) hi = mid;
    else lo = mid + 1;
  }
  return steps[lo] as number;
}

function measureOne(el: HTMLElement, draft: SlideDraft, steps: readonly number[], step: number): DraftFit {
  if (draft.kind === 'title') {
    // Tittellysbildet: egenskapene (og ingressen) krympes hvis notatet har mange; tittelen krympes aldri.
    const grid = el.querySelector<HTMLElement>('[data-title-box]');
    if (!grid) return { scale: 1, breaks: [], scrollUnits: [] };
    return { scale: shrinkOnly(el, grid, fontScaleSteps(step, AGENDA_MIN_SCALE)), breaks: [], scrollUnits: [] };
  }
  const box = el.querySelector<HTMLElement>('[data-fit-box]');
  if (!box) return { scale: 1, breaks: [], scrollUnits: [] };
  const overflow: UnitOverflow[] = draft.units.map((u) => u.overflow);
  if (draft.kind === 'agenda' || draft.kind === 'transition') {
    // Agendaen krympes, men deles ikke (minimum 0,55, designsystem §12.4).
    return { scale: shrinkOnly(el, box, fontScaleSteps(step, AGENDA_MIN_SCALE)), breaks: [], scrollUnits: [] };
  }
  return fitDraft({ measure: (s) => measureBox(el, box, s), steps, overflow });
}

interface Props {
  readonly requests: readonly MeasureRequest[];
  readonly deck: DeckInfo;
  readonly onMeasured: (results: ReadonlyArray<{ readonly key: string; readonly fit: DraftFit }>) => void;
}

export function MeasureCanvas({ requests, deck: shownDeck, onMeasured }: Props) {
  const root = useRef<HTMLDivElement>(null);
  // Lysbildenumrene i agendaen er ikke kjent før målingen er ferdig: to sifre som plassholder (samme bredde).
  const deck = useMemo<DeckInfo>(() => ({ ...shownDeck, startNumbers: shownDeck.agenda.map(() => 88) }), [shownDeck]);
  const items = useMemo(
    () =>
      requests.map((r): { request: MeasureRequest; slide: Slide; title: Slide | null } => {
        const slide = draftAsSlide(r.draft);
        // S6: innledningen prøves først på tittellysbildet.
        const title: Slide | null = r.draft.preamble ? { ...slide, id: `${slide.id}@tittel`, kind: 'title', heading: deck.title, withPreamble: true } : null;
        return { request: r, slide, title };
      }),
    [requests, deck.title],
  );

  useLayoutEffect(() => {
    const host = root.current;
    if (!host || items.length === 0) return;
    const canvas = host.querySelector<HTMLElement>('.canvas') ?? host;
    const step = cssNumber(canvas, '--slide-fit-step', DEFAULT_FIT_STEP);
    const min = cssNumber(canvas, '--slide-text-min-lp', DEFAULT_MIN_FONT_SCALE * 40) / cssNumber(canvas, '--slide-body-lp', 40);
    const steps = fontScaleSteps(step, min);
    const results = items.map(({ request, slide, title }) => {
      if (title) {
        const t = host.querySelector<HTMLElement>(`[data-measure="${CSS.escape(title.id)}"] .t-grid`);
        if (t && t.scrollHeight <= t.clientHeight + 1) return { key: request.key, fit: { scale: 1, breaks: [], scrollUnits: [], onTitle: true } };
      }
      const el = host.querySelector<HTMLElement>(`[data-measure="${CSS.escape(slide.id)}"] .slide`);
      return { key: request.key, fit: el ? measureOne(el, request.draft, steps, step) : { scale: 1, breaks: [], scrollUnits: [] } };
    });
    onMeasured(results);
  }, [items, onMeasured]);

  if (items.length === 0) return null;
  return (
    <div className="measure-host" ref={root} aria-hidden="true" inert>
      {items.map(({ slide, title }) => (
        <div key={slide.id} className="measure-pair">
          <div className="canvas measure-canvas" data-measure={slide.id}>
            <SlideView slide={slide} deck={deck} mode="measure" active />
          </div>
          {title ? (
            <div className="canvas measure-canvas" data-measure={title.id}>
              <SlideView slide={title} deck={deck} mode="measure" active />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
