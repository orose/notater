// Porten kommandoene når presentasjonen gjennom (ADR-010 §3, samme mønster som `OutlineHost`/`OutlineControl`).
// `PresentationProvider` (slice 2-a) monteres i `VaultLayout` over `CommandProvider` og eier URL-parameteren,
// modusbyttet og fullskjerm; `commands` leser den med `usePresentationControl()` og importerer ikke resten.

import type { HeadingLevel } from './model';

export interface PresentationStatus {
  /** `?lysbilde` finnes: tastaturmotoren er i modus `present`. */
  readonly active: boolean;
  /** Nivåene `:presenter h<n>` godtar for notatet som vises (tom når det ikke er et notat). */
  readonly validLevels: readonly HeadingLevel[];
  /** Lysbildenivået som brukes (lagret overstyring eller automatisk), `null` uten overskrifter. */
  readonly slideLevel: HeadingLevel | null;
  /** Lagret overstyring for notatet (`null` = automatisk). */
  readonly storedLevel: HeadingLevel | null;
  /** Overgangslysbilder på (standard) eller slått av med `:agenda av` for denne presentasjonen. */
  readonly transitions: boolean;
  readonly overviewOpen: boolean;
  readonly blackout: boolean;
  readonly fullscreen: boolean;
}

export interface PresentationControl {
  readonly status: PresentationStatus;
  /**
   * `Space p` / `:presenter [h<n>|auto]`. Kalles synkront fra brukergesten (fullskjerm krever det).
   * Utenfor presentasjon: lagrer evt. nivået, ber om fullskjerm og legger `?lysbilde=` på historikken.
   * Under presentasjon: bytter nivå og beholder posisjonen (`resolveSlide`).
   */
  start(level?: HeadingLevel | 'auto'): void;
  next(): void;
  previous(): void;
  first(): void;
  last(): void;
  toggleOverview(): void;
  toggleBlackout(): void;
  setTransitions(on: boolean): void;
  toggleFullscreen(): void;
  /** Esc i present-modus: lukk oversikten, ellers avslutt. `false` når ingen presentasjon vises. */
  escape(): boolean;
  /** Avslutt og gå tilbake til samme sted i notatet. */
  stop(): void;
}
