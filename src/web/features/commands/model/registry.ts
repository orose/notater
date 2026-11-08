// Registeret = katalog + handlere (ADR-007 §1). Ren TS.

import { KEY_MODES, chordId, parseKeySequence, type EngineBinding, type EngineKeymap, type KeyMode } from '../../keyboard';
import { COMMAND_CATALOG, COMMAND_IDS, type CommandId } from './catalog';
import type { CommandContext } from './command-context';
import { ENABLED, type Availability, type ArgumentValue, type CommandHandler, type CommandSpecBody } from './command-types';

/** Én handler per kommando-id – mangler én, feiler typesjekken. */
export type CommandHandlers = { readonly [K in CommandId]: CommandHandler };

export interface Command extends CommandSpecBody {
  readonly id: CommandId;
  isEnabled(ctx: CommandContext): Availability;
  state(ctx: CommandContext): string | null;
  argumentValues(ctx: CommandContext, name: string): readonly ArgumentValue[];
  run(ctx: CommandContext, args: Readonly<Record<string, string>>): void | Promise<void>;
}

export interface CommandRegistry {
  /** I katalogrekkefølge. */
  readonly commands: readonly Command[];
  get(id: CommandId): Command;
  /** Tastaturkart til motoren, per modus. */
  keymap(): EngineKeymap;
}

/** Katalogens bindinger som flate rader (til policytest, `?`-oversikt og README). */
export function catalogBindings(): Array<{ commandId: CommandId; mode: KeyMode; keys: string; repeat: boolean; inTextFields: boolean }> {
  return COMMAND_IDS.flatMap((id) => {
    const spec: CommandSpecBody = COMMAND_CATALOG[id];
    return KEY_MODES.flatMap((mode) =>
      (spec.bindings[mode] ?? []).map((b) => ({ commandId: id, mode, keys: b.keys, repeat: b.repeat ?? false, inTextFields: b.inTextFields ?? false })),
    );
  });
}

export function createCommandRegistry(handlers: CommandHandlers): CommandRegistry {
  const commands: Command[] = COMMAND_IDS.map((id) => {
    const spec: CommandSpecBody = COMMAND_CATALOG[id];
    const handler = handlers[id];
    return {
      ...spec,
      id,
      isEnabled: (ctx) => handler.isEnabled?.(ctx) ?? ENABLED,
      state: (ctx) => handler.state?.(ctx) ?? null,
      argumentValues: (ctx, name) => handler.argumentValues?.(ctx, name) ?? [],
      run: (ctx, args) => handler.run(ctx, args),
    };
  });
  const byId = new Map(commands.map((c) => [c.id, c]));
  const keymap = Object.fromEntries(
    KEY_MODES.map((mode) => [
      mode,
      catalogBindings()
        .filter((b) => b.mode === mode)
        .map<EngineBinding>((b) => ({
          commandId: b.commandId,
          chords: parseKeySequence(b.keys).map(chordId),
          repeat: b.repeat,
          inTextFields: b.inTextFields,
        })),
    ]),
  ) as Record<KeyMode, EngineBinding[]>;

  return {
    commands,
    get: (id) => byId.get(id) as Command,
    keymap: () => keymap,
  };
}
