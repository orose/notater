import { useContext } from 'react';
import { ViewSettingsContext, type ViewSettingsValue } from './view-settings-context';

const FALLBACK: ViewSettingsValue = {
  width: 'readable',
  setWidth: () => {},
  toggleWidth: () => 'readable',
  zen: false,
  setZen: () => {},
  zenHint: false,
  dismissZenHint: () => {},
  isDiscreet: () => false,
  toggleDiscreet: () => false,
  moveDiscreet: () => {},
};

export function useViewSettings(): ViewSettingsValue {
  return useContext(ViewSettingsContext) ?? FALLBACK;
}
