// Lysbildemodellen (ADR-010) og tilpasningsalgoritmen (A2), ren TS uten plattform (ADR-011 §1).
// Web og terminal bruker samme vei: prepareSlideSource → buildSlideDrafts → fitDraft → finalizeDeck → resolveSlide.
export {
  AGENDA_SLIDE_ID,
  PREAMBLE_SLIDE_ID,
  RESERVED_SLIDE_KEYS,
  TITLE_SLIDE_ID,
  TRANSITION_PREFIX,
  formatSlideId,
  parseSlideId,
  transitionSlideId,
  type ParsedSlideId,
} from './model/slide-id';
export { agendaStartNumbers, agendaSubtitles, headingForSlide, slideForHeading } from './model/agenda';
export { buildSlideDrafts, fromOutline, presentationLevels } from './model/build-slides';
export { CONTINUED_SUFFIX, finalizeDeck, footnotesOf } from './model/finalize-deck';
export { resolveSlide, type Locatable, type ResolveReason, type ResolvedSlide } from './model/resolve-slide';
export type {
  AgendaItem,
  BuildSlideDrafts,
  DeckFit,
  DraftFit,
  FinalizeDeck,
  FinalizeOptions,
  FlowBlock,
  FlowHeading,
  HeadingLevel,
  Slide,
  SlideAddress,
  SlideDeck,
  SlideDraft,
  SlideDraftDeck,
  SlideFootnote,
  SlideKind,
  SlideOptions,
  SlideProgress,
  SlideSource,
  SlideUnit,
  UnitOverflow,
} from './model/slide-types';
export { fitDraft, packUnits, ORPHAN_ROOM, type FitInput, type Geometry } from './fit/fit-algorithm';
export { createFitCache, fitKeyString, FIT_CACHE_MAX } from './fit/fit-cache';
export {
  DEFAULT_FIT_STEP,
  DEFAULT_MIN_FONT_SCALE,
  UNMEASURED,
  fontScaleSteps,
  type FitCache,
  type FitKey,
  type FitProgress,
} from './fit/fit-types';
export { baseIdsIn, cyrb53, draftContentKey } from './fit/fingerprint';
export { prepareSlideSource, presentationLevelInfo, type LevelInfo, type PreparedSlideSource } from './prepare-source';
