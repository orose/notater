import { createContext } from 'react';
import type { ReadingWidth } from './view-state';

export interface ViewSettingsValue {
  readonly width: ReadingWidth;
  readonly setWidth: (width: ReadingWidth) => void;
  readonly toggleWidth: () => ReadingWidth;
  /** Zen (F4): flyktig, alltid av ved oppstart. */
  readonly zen: boolean;
  readonly setZen: (on: boolean) => void;
}

export const ViewSettingsContext = createContext<ViewSettingsValue | null>(null);
