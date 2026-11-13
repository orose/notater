// Presentasjonens tilstand i terminalen (ADR-011 §7) som rene funksjoner: kortstokk fra den delte modellen, posisjon,
// nivå, overganger og svart skjerm. Bytte av nivå, ny tilpasning og live endring beholder posisjonen med `resolveSlide`
// (AR-2-15), som i web.

import type { NoteDocument } from '../../../shared/api-types';
import {
  buildSlideDrafts,
  finalizeDeck,
  prepareSlideSource,
  presentationLevelInfo,
  resolveSlide,
  type DeckFit,
  type HeadingLevel,
  type LevelInfo,
  type Slide,
  type SlideDeck,
  type SlideDraftDeck,
} from '../../../core/presentation';

export interface DeckOptions {
  /** `--niva h<n>` / `:presenter h<n>`; `null` = automatisk. */
  readonly level: HeadingLevel | null;
  /** `--uten-agenda` / `:agenda av` slår dem av. */
  readonly transitions: boolean;
}

/** Tilpasningen for utkastene (terminalens geometri, slice 3-c). Standard: ingen deling. */
export type DeckFitter = (drafts: SlideDraftDeck, doc: NoteDocument) => DeckFit;

export const UNFITTED: DeckFitter = () => ({ drafts: {}, compactAgendaLine: false, complete: true });

export interface PresentState {
  readonly doc: NoteDocument;
  readonly deck: SlideDeck;
  readonly index: number;
  readonly options: DeckOptions;
  readonly blackout: boolean;
}

export function buildDeck(doc: NoteDocument, options: DeckOptions, fit: DeckFitter = UNFITTED): SlideDeck {
  const drafts = buildSlideDrafts(prepareSlideSource(doc).source, { slideLevel: options.level });
  return finalizeDeck(drafts, fit(drafts, doc), { transitions: options.transitions });
}

/** Nivåene notatet har overskrifter på (`:presenter`-underlisten, E486). */
export function levelsOf(doc: NoteDocument): readonly LevelInfo[] {
  return presentationLevelInfo(prepareSlideSource(doc).source);
}

/** Starter på tittellysbildet (ADR-011 §7). */
export function startPresent(doc: NoteDocument, options: DeckOptions, fit: DeckFitter = UNFITTED): PresentState {
  return { doc, deck: buildDeck(doc, options, fit), index: 0, options, blackout: false };
}

export function currentSlide(state: PresentState): Slide | null {
  return state.deck.slides[state.index] ?? null;
}

const clamp = (state: PresentState, index: number): number => Math.max(0, Math.min(state.deck.slides.length - 1, index));

/** Neste/forrige: under svart skjerm vises lysbildet igjen uten å bla (som web). */
export function step(state: PresentState, direction: 1 | -1): PresentState {
  if (state.blackout) return { ...state, blackout: false };
  const index = clamp(state, state.index + direction);
  return index === state.index ? state : { ...state, index };
}

export function goTo(state: PresentState, index: number): PresentState {
  return { ...state, index: clamp(state, index), blackout: false };
}

export function toggleBlackout(state: PresentState): PresentState {
  return { ...state, blackout: !state.blackout };
}

/** Ny kortstokk (nytt nivå, overganger, tilpasning eller dokument) med samme lysbilde (`resolveSlide`). */
export function rebuild(state: PresentState, change: { readonly doc?: NoteDocument; readonly options?: DeckOptions }, fit: DeckFitter = UNFITTED): PresentState {
  const doc = change.doc ?? state.doc;
  const options = change.options ?? state.options;
  const deck = buildDeck(doc, options, fit);
  const current = currentSlide(state);
  const resolved = current ? resolveSlide(deck.slides, current.id, state.deck.slides) : { index: 0 };
  return { ...state, doc, deck, options, index: Math.max(0, resolved.index) };
}
