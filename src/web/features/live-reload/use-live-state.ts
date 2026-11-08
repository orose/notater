import { useContext } from 'react';
import { LiveContext, type LiveState } from './live-context';

export function useLiveState(): LiveState {
  return useContext(LiveContext);
}
