import { createContext } from 'react';
import type { ReadingWidth } from './view-state';

export interface ViewSettingsValue {
  readonly width: ReadingWidth;
  readonly setWidth: (width: ReadingWidth) => void;
  readonly toggleWidth: () => ReadingWidth;
  /** Zen (F4): flyktig, alltid av ved oppstart. */
  readonly zen: boolean;
  readonly setZen: (on: boolean) => void;
  /** Førstegangshintet for zen skal vises (de tre første gangene, designsystem §11.6). */
  readonly zenHint: boolean;
  readonly dismissZenHint: () => void;
  /** Diskré embedding (F2): per vault + notat, huskes. */
  readonly isDiscreet: (vaultId: string, docPath: string) => boolean;
  /** Veksler og returnerer ny verdi (til toast). */
  readonly toggleDiscreet: (vaultId: string, docPath: string) => boolean;
  /** Omdøping (PO-49): valget følger notatet. */
  readonly moveDiscreet: (vaultId: string, from: string, to: string) => void;
}

export const ViewSettingsContext = createContext<ViewSettingsValue | null>(null);
