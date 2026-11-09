// Presentasjonsmodus (v2, ADR-010). Offentlig flate; andre features importerer kun herfra.
export { PresentationLayer } from './PresentationLayer';
export { PresentationMoveSync } from './PresentationMoveSync';
export { PresentationProvider } from './PresentationProvider';
export { usePresentationControl } from './presentation-context';
export {
  AGENDA_SLIDE_ID,
  PREAMBLE_SLIDE_ID,
  TITLE_SLIDE_ID,
  formatSlideId,
  parseSlideId,
  resolveSlide,
  transitionSlideId,
  type DeckFit,
  type DraftFit,
  type HeadingLevel,
  type Slide,
  type SlideDeck,
  type SlideKind,
} from './model';
export {
  CANVAS,
  DEFAULT_FIT_STEP,
  DEFAULT_MIN_FONT_SCALE,
  UNMEASURED,
  fontScaleSteps,
  type FitCache,
  type FitKey,
  type FitProgress,
} from './fit/fit-types';
export {
  PRESENTATION_LEVELS_MAX,
  PRESENTATION_STORAGE_KEY,
  levelIn,
  moveLevelIn,
  normalizeLevels,
  presentationKey,
  readLevels,
  setLevelIn,
  writeLevels,
  type StoredLevels,
} from './presentation-storage';
export { SLIDE_PARAM, slideParam, withSlideParam } from './presentation-url';
export { enterPresentationFullscreen, exitPresentationFullscreen, isPresentationFullscreen, type FullscreenOutcome } from './fullscreen';
export type { LevelInfo, NoticeHandler, PresentationControl, PresentationStatus } from './presentation-control';
