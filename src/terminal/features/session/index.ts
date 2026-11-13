/** session: presentasjonens tilstand som rene funksjoner over den delte lysbildemodellen (ADR-011 §7). */
export {
  UNFITTED,
  buildDeck,
  currentSlide,
  goTo,
  levelsOf,
  rebuild,
  startPresent,
  step,
  toggleBlackout,
  type DeckFitter,
  type DeckOptions,
  type PresentState,
} from './present-session';
