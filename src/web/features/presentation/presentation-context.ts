import { createContext, useContext } from 'react';
import type { BaseResult, NoteDocument } from '../../../shared/api-types';
import type { DraftFit, SlideDeck, SlideDraft, SlideDraftDeck } from './model';
import type { PresentationControl } from './presentation-control';

/** Et utkast som skal måles (A2), med cachenøkkelen resultatet lagres under. */
export interface MeasureRequest {
  readonly draft: SlideDraft;
  readonly key: string;
}

/** Alt laget trenger for å vise presentasjonen (endres ved hvert lysbildebytte). */
export interface PresentationView {
  readonly vaultId: string;
  readonly doc: NoteDocument;
  readonly bases: Readonly<Record<string, BaseResult>>;
  readonly drafts: SlideDraftDeck;
  /** Kortstokken som vises (forrige vises til gjeldende er målt, ADR-010 §5). `null` til første måling er ferdig. */
  readonly deck: SlideDeck | null;
  readonly index: number;
  readonly overviewOpen: boolean;
  readonly blackout: boolean;
  /** Utkast som mangler tilpasning. */
  readonly measure: readonly MeasureRequest[];
  readonly onMeasured: (results: ReadonlyArray<{ readonly key: string; readonly fit: DraftFit }>) => void;
  readonly go: (index: number) => void;
  readonly closeOverview: () => void;
  /** Gjeldende lysbilde har en blokk med intern rulling som skal rulles (`↑`/`↓`): teller som øker per trykk. */
  readonly scrollRequest: { readonly direction: 1 | -1; readonly n: number };
}

export const PresentationControlContext = createContext<PresentationControl | null>(null);
export const PresentationViewContext = createContext<PresentationView | null>(null);

/** Kontrollen for kommandoene (`null` utenfor `PresentationProvider`). */
export function usePresentationControl(): PresentationControl | null {
  return useContext(PresentationControlContext);
}

export function usePresentationView(): PresentationView | null {
  return useContext(PresentationViewContext);
}
