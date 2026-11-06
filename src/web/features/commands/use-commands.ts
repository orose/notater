import { useContext } from 'react';
import { CommandsContext, type CommandsContextValue } from './commands-context';

const NOOP: CommandsContextValue = { openShortcuts: () => {} };

export function useCommands(): CommandsContextValue {
  return useContext(CommandsContext) ?? NOOP;
}
