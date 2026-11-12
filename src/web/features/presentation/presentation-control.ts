// Porten kommandoene når presentasjonen gjennom (ADR-010 §3, samme mønster som `OutlineHost`/`OutlineControl`).
// `PresentationProvider` monteres i `VaultLayout` over `CommandProvider` og eier URL-parameteren, modusbyttet og
// fullskjerm; `commands` leser den med `usePresentationControl()` og importerer ikke resten.
//
// Strukturelt lik `PresentationPort` i `src/core/commands/command-context.ts` (den rene modellen importerer ikke hit).

import type { HeadingLevel, LevelInfo } from '../../../core/presentation';

export interface PresentationStatus {
  /** `?lysbilde` finnes på et notat som finnes: tastaturmotoren er i modus `present`. */
  readonly active: boolean;
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

export type { LevelInfo } from '../../../core/presentation';

/** Kort melding i appens varselsone (toast), valgfritt med tasttegn. Registreres av `CommandProvider`. */
export type NoticeHandler = (message: string, keys?: readonly string[]) => void;

export interface PresentationControl extends PresentationStatus {
  /** Nivåene notatet som vises har overskrifter på, med agendanivå og antall lysbilder (beregnes ved behov). */
  levels(): readonly LevelInfo[];
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
  /** `↑`/`↓`: ruller en for stor blokk på gjeldende lysbilde (PO-94). */
  scroll(direction: 1 | -1): void;
  toggleOverview(): void;
  toggleBlackout(): void;
  setTransitions(on: boolean): void;
  toggleFullscreen(): void;
  /** Esc i present-modus: lukk oversikten / svart skjerm, ellers avslutt. `false` når ingen presentasjon vises. */
  escape(): boolean;
  /** Avslutt og gå til seksjonen for gjeldende lysbilde i notatet (PO-87). */
  stop(): void;
  /** `CommandProvider` registrerer varselsonen sin her. */
  setNoticeHandler(handler: NoticeHandler | null): void;
}
