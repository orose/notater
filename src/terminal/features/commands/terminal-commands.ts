// Kommandoene i terminalen (ADR-011 §6): samme katalog, register og tastaturmotor som web, flaten «terminal».
// Handlerne lukker over presentasjonens handlinger; `CommandContext` brukes bare til modus (present) og
// tilgjengelighet. Lese-kommandoene fra web (bare normal-modus) får den felles «ikke tilgjengelig»-handleren.

import {
  createCommandRegistry,
  presentLevelError,
  type ArgumentValue,
  surfaceCommandIds,
  type CommandContext,
  type CommandHandler,
  type CommandHandlers,
  type CommandPorts,
  type CommandRegistry,
} from '../../../core/commands';
import { chordCandidates, createKeyEngine, type EngineTimers, type KeyEngine, type KeyResult } from '../../../core/keyboard';
import type { DecodedKey } from '../keys';

/** Et nivå notatet har overskrifter på (`:presenter`-underlisten). */
export interface TerminalLevel {
  readonly level: number;
  readonly agendaLevel: number | null;
  readonly slides: number;
}

export type ColorChoice = 'terminal' | 'palett';

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
  scroll(direction: 1 | -1): void;
  toggleOverview(): void;
  openCommandLine(): void;
  openHelp(): void;
  /** `:presenter h<n>|auto` (huskes ikke, PO-107). */
  setLevel(level: number | 'auto'): void;
  levels(): readonly TerminalLevel[];
  readonly slideLevel: () => number | null;
  setTransitions(on: boolean): void;
  readonly transitions: () => boolean;
  setPalette(name: string): void;
  readonly palettes: () => readonly ArgumentValue[];
  setColors(choice: ColorChoice): void;
  readonly colors: () => ColorChoice;
  setMode(mode: 'light' | 'dark' | 'toggle'): void;
  readonly mode: () => 'light' | 'dark';
  /** Kort bekreftelse nederst (2 s). */
  notice(message: string): void;
}

export const NOT_IN_TERMINAL = 'Ikke i terminalen';

/** Felles handler for kommandoer flaten har, men som ikke gjør noe i terminalens presentasjon. */
export function unavailableHandler(reason: string = NOT_IN_TERMINAL): CommandHandler {
  return { isEnabled: () => ({ enabled: false, reason }), run: () => undefined };
}

const onOff = (on: boolean) => (on ? 'på' : 'av');

/** Handlerne for flaten «terminal». Kommandoer uten egen handler (lese-kommandoene) får `unavailableHandler`. */
export function terminalHandlers(actions: TerminalActions): CommandHandlers<'terminal'> {
  const run = (fn: () => void): CommandHandler => ({ run: () => fn() });
  const levelValues = (): ArgumentValue[] => [
    { value: 'auto', label: 'auto', description: 'Lysbildenivå fra notatets overskrifter' },
    ...actions.levels().map((l) => ({
      value: `h${l.level}`,
      label: `h${l.level}`,
      description: `${l.agendaLevel === null ? 'ingen agenda' : `agenda h${l.agendaLevel}`} · ${l.slides} lysbilder`,
      current: actions.slideLevel() === l.level,
    })),
  ];
  const own: Partial<Record<string, CommandHandler>> = {
    'present.next': run(actions.next),
    'present.previous': run(actions.previous),
    'present.first': run(actions.first),
    'present.last': run(actions.last),
    'present.blackout': run(actions.toggleBlackout),
    'present.stop': run(actions.stop),
    'system.escape': run(actions.escape),
    'present.overview': run(actions.toggleOverview),
    'present.scrollDown': run(() => actions.scroll(1)),
    'present.scrollUp': run(() => actions.scroll(-1)),
    'palette.commands': run(actions.openCommandLine),
    'help.shortcuts': run(actions.openHelp),
    'present.start': {
      state: () => (actions.slideLevel() === null ? 'auto' : `h${actions.slideLevel()}`),
      argumentValues: (_ctx, name) => (name === 'nivå' ? levelValues() : []),
      argumentError: (_ctx, name, input) => (name === 'nivå' ? presentLevelError(input, actions.levels().map((l) => l.level)) : null),
      run: (_ctx, args) => {
        const raw = (args.nivå ?? '').trim().toLowerCase();
        if (raw === '') {
          actions.notice('Presentasjonen vises allerede.');
          return;
        }
        const error = presentLevelError(raw, actions.levels().map((l) => l.level));
        if (error) {
          actions.notice(`${error.code}: ${error.title}`);
          return;
        }
        actions.setLevel(raw === 'auto' ? 'auto' : Number(raw.slice(1)));
        actions.notice(raw === 'auto' ? 'Lysbildenivå automatisk · ikke lagret' : `Lysbildenivå ${raw} · ikke lagret`);
      },
    },
    'present.agenda': {
      state: () => onOff(actions.transitions()),
      argumentValues: (_ctx, name) =>
        name === 'verdi'
          ? [
              { value: 'av', label: 'av', description: 'Ingen overgangslysbilder i denne presentasjonen' },
              { value: 'på', label: 'på', aliases: ['pa'], description: 'Agendaen med «du er her» før hvert agendapunkt' },
            ]
          : [],
      run: (_ctx, args) => {
        const value = (args.verdi ?? '').trim().toLowerCase();
        const on = value === 'av' ? false : value === 'på' || value === 'pa' ? true : !actions.transitions();
        actions.setTransitions(on);
        actions.notice(on ? 'Overganger på' : 'Overganger av · huskes ikke');
      },
    },
    'theme.setPalette': {
      state: () => actions.palettes().find((p) => p.current)?.label ?? null,
      argumentValues: (_ctx, name) => (name === 'palette' ? actions.palettes() : []),
      run: (_ctx, args) => {
        if (args.palette) actions.setPalette(args.palette);
      },
    },
    'terminal.colors': {
      state: () => actions.colors(),
      argumentValues: (_ctx, name) =>
        name === 'farger'
          ? [
              { value: 'terminal', label: 'terminal', description: 'Terminalens egne 16 farger (standard)', current: actions.colors() === 'terminal' },
              { value: 'palett', label: 'palett', description: 'Vaultleserens palett i truecolor', current: actions.colors() === 'palett' },
            ]
          : [],
      run: (_ctx, args) => actions.setColors(args.farger === 'palett' ? 'palett' : 'terminal'),
    },
    'theme.toggleMode': run(() => actions.setMode('toggle')),
    'theme.light': run(() => actions.setMode('light')),
    'theme.dark': run(() => actions.setMode('dark')),
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
