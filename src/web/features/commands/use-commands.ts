import { useContext } from 'react';
import { CommandsContext, type CommandsContextValue } from './commands-context';

const NOOP: CommandsContextValue = { openShortcuts: () => {}, run: () => {}, availability: () => ({ enabled: true }) };

export function useCommands(): CommandsContextValue {
  return useContext(CommandsContext) ?? NOOP;
}
