import { createContext } from 'react';

export interface LiveState {
  readonly status: 'connecting' | 'live' | 'offline';
  readonly lastSync: Date | null;
  /** Øker ved hver endring (for en kort «blink» i statusprikken). */
  readonly pulse: number;
}

export const INITIAL_LIVE_STATE: LiveState = { status: 'connecting', lastSync: null, pulse: 0 };

export const LiveContext = createContext<LiveState>(INITIAL_LIVE_STATE);
