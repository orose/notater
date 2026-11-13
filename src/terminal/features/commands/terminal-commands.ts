// Kommandoene i terminalen (ADR-011 §6): samme katalog, register og tastaturmotor som web, flaten «terminal».
// Handlerne lukker over presentasjonens handlinger; `CommandContext` brukes bare til modus (present) og
// tilgjengelighet. Lese-kommandoene fra web (bare normal-modus) får den felles «ikke tilgjengelig»-handleren.

import {
  createCommandRegistry,
  surfaceCommandIds,
  type CommandContext,
  type CommandHandler,
  type CommandHandlers,
  type CommandPorts,
  type CommandRegistry,
} from '../../../core/commands';
import { chordCandidates, createKeyEngine, type EngineTimers, type KeyEngine, type KeyResult } from '../../../core/keyboard';
import type { DecodedKey } from '../keys';

/** Det presentasjonen i terminalen kan gjøre (implementeres av komposisjonsroten). */
export interface TerminalActions {
  next(): void;
  previous(): void;
  first(): void;
  last(): void;
  toggleBlackout(): void;
  /** Esc: lukk overlegg → slå av svart skjerm → avslutt (PO-103, ADR-011 §6). */
  escape(): void;
  stop(): void;
}

export const NOT_IN_TERMINAL = 'Ikke i terminalen';
export const COMING_LATER = 'Kommer i neste leveranse';

/** Felles handler for kommandoer flaten har, men som ikke gjør noe i terminalens presentasjon. */
export function unavailableHandler(reason: string = NOT_IN_TERMINAL): CommandHandler {
  return { isEnabled: () => ({ enabled: false, reason }), run: () => undefined };
}

/** Handlerne for flaten «terminal». Kommandoer uten egen handler får `unavailableHandler`. */
export function terminalHandlers(actions: TerminalActions): CommandHandlers<'terminal'> {
  const run = (fn: () => void): CommandHandler => ({ run: () => fn() });
  const own: Partial<Record<string, CommandHandler>> = {
    'present.next': run(actions.next),
    'present.previous': run(actions.previous),
    'present.first': run(actions.first),
    'present.last': run(actions.last),
    'present.blackout': run(actions.toggleBlackout),
    'present.stop': run(actions.stop),
    'system.escape': run(actions.escape),
    // Slice 3-b/3-c: oversikt, rulling, kommandolinje, hjelp, paletter og farger.
    'present.overview': unavailableHandler(COMING_LATER),
    'present.scrollDown': unavailableHandler(COMING_LATER),
    'present.scrollUp': unavailableHandler(COMING_LATER),
    'present.agenda': unavailableHandler(COMING_LATER),
    'palette.commands': unavailableHandler(COMING_LATER),
    'help.shortcuts': unavailableHandler(COMING_LATER),
    'theme.setPalette': unavailableHandler(COMING_LATER),
    'theme.toggleMode': unavailableHandler(COMING_LATER),
    'theme.light': unavailableHandler(COMING_LATER),
    'theme.dark': unavailableHandler(COMING_LATER),
    'terminal.colors': unavailableHandler(COMING_LATER),
  };
  const fallback = unavailableHandler();
  return Object.fromEntries(surfaceCommandIds('terminal').map((id) => [id, own[id] ?? fallback])) as CommandHandlers<'terminal'>;
}

/** Konteksten kommandoene ser i terminalen: alltid presentasjon, ingen nettleserporter. */
export const TERMINAL_CONTEXT: CommandContext = {
  mode: 'present',
  route: { kind: 'note', vaultId: null, docPath: null },
  view: { width: 'full', discreet: true, zen: true, noteEmbeds: 0, foldableHeadings: 0 },
  ports: {} as CommandPorts,
};

export interface TerminalKeys {
  readonly registry: CommandRegistry<'terminal'>;
  /** Ett tastetrykk fra dekoderen → motoren → kommando. */
  handle(key: DecodedKey): KeyResult;
  /** Avbryt påbegynt sekvens (`g` …) når et overlegg åpnes. */
  cancel(): void;
  dispose(): void;
}

export function createTerminalKeys(actions: TerminalActions, timers: EngineTimers, onUnavailable: (reason: string) => void = () => undefined): TerminalKeys {
  const registry = createCommandRegistry('terminal', terminalHandlers(actions));
  const engine: KeyEngine = createKeyEngine({
    keymap: registry.keymap(),
    timers,
    initialMode: 'present',
    hintPrefixes: [],
    onCommand: (id) => {
      const command = registry.commands.find((c) => c.id === id);
      if (!command) return;
      const availability = command.isEnabled(TERMINAL_CONTEXT);
      if (!availability.enabled) {
        onUnavailable(availability.reason);
        return;
      }
      void command.run(TERMINAL_CONTEXT, {});
    },
  });
  return {
    registry,
    handle: (key) => engine.handle(chordCandidates(key), { repeat: false, typing: false }),
    cancel: () => engine.cancel(),
    dispose: () => engine.dispose(),
  };
}
