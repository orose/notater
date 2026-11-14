// Registeret = katalog + handlere (ADR-007 §1). Ren TS.

import { KEY_MODES, chordId, parseKeySequence, type EngineBinding, type EngineKeymap, type KeyMode } from '../keyboard';
import { COMMAND_CATALOG, COMMAND_IDS, type CommandId } from './catalog';
import type { CommandContext } from './command-context';
import {
  ENABLED,
  NOT_WHILE_PRESENTING,
  ONLY_WHILE_PRESENTING,
  type Availability,
  type ArgumentError,
  type ArgumentValue,
  type CommandHandler,
  type CommandSpecBody,
  type Surface,
} from './command-types';

type SurfacesOf<K extends CommandId> = (typeof COMMAND_CATALOG)[K] extends { readonly surfaces: readonly (infer S)[] } ? S : Surface;

/** Kommandoene en flate har (`surfaces`, standard: alle), som type. */
export type SurfaceCommandId<S extends Surface> = { [K in CommandId]: S extends SurfacesOf<K> ? K : never }[CommandId];

/** Én handler per kommando-id flaten har – mangler én, feiler typesjekken (ADR-011 §6). */
export type CommandHandlers<S extends Surface = 'web'> = { readonly [K in SurfaceCommandId<S>]: CommandHandler };

export interface Command extends CommandSpecBody {
  readonly id: CommandId;
  isEnabled(ctx: CommandContext): Availability;
  state(ctx: CommandContext): string | null;
  argumentValues(ctx: CommandContext, name: string): readonly ArgumentValue[];
  argumentError(ctx: CommandContext, name: string, input: string): ArgumentError | null;
  run(ctx: CommandContext, args: Readonly<Record<string, string>>): void | Promise<void>;
}

export interface CommandRegistry<S extends Surface = 'web'> {
  readonly surface: S;
  /** Flatens kommandoer i katalogrekkefølge. */
  readonly commands: readonly Command[];
  /** Kommandoen med id-en; finnes den ikke på flaten, er svaret `undefined` (bare via feil i kallet). */
  get(id: CommandId): Command;
  /** Tastaturkart til motoren, per modus (med flatens ekstra taster). */
  keymap(): EngineKeymap;
}

function onSurface(spec: CommandSpecBody, surface: Surface): boolean {
  return !spec.surfaces || spec.surfaces.includes(surface);
}

/** Kommando-id-ene flaten har, i katalogrekkefølge. */
export function surfaceCommandIds<S extends Surface>(surface: S): SurfaceCommandId<S>[] {
  return COMMAND_IDS.filter((id) => onSurface(COMMAND_CATALOG[id], surface)) as SurfaceCommandId<S>[];
}

/**
 * Flatens bindinger som flate rader (til policytest, `?`-oversikt og README). Standard: web. Felles `bindings` først,
 * deretter flatens `surfaceBindings`.
 */
export function catalogBindings(surface: Surface = 'web'): Array<{ commandId: CommandId; mode: KeyMode; keys: string; repeat: boolean; inTextFields: boolean }> {
  return surfaceCommandIds(surface).flatMap((id) => {
    const spec: CommandSpecBody = COMMAND_CATALOG[id];
    return KEY_MODES.flatMap((mode) =>
      [...(spec.bindings[mode] ?? []), ...(spec.surfaceBindings?.[surface]?.[mode] ?? [])].map((b) => ({
        commandId: id,
        mode,
        keys: b.keys,
        repeat: b.repeat ?? false,
        inTextFields: b.inTextFields ?? false,
      })),
    );
  });
}

export function createCommandRegistry<S extends Surface>(surface: S, handlers: CommandHandlers<S>): CommandRegistry<S> {
  const byHandler = handlers as unknown as Readonly<Record<string, CommandHandler>>;
  const commands: Command[] = surfaceCommandIds(surface).map((id) => {
    const spec: CommandSpecBody = COMMAND_CATALOG[id];
    const handler = byHandler[id] as CommandHandler;
    return {
      ...spec,
      id,
      isEnabled: (ctx) => {
        // ADR-010 §3: lese-kommandoer under presentasjon, present-kommandoer utenfor.
        if (spec.modes && !spec.modes.includes(ctx.mode)) return { enabled: false, reason: ctx.mode === 'present' ? NOT_WHILE_PRESENTING : ONLY_WHILE_PRESENTING };
        return handler.isEnabled?.(ctx) ?? ENABLED;
      },
      state: (ctx) => handler.state?.(ctx) ?? null,
      argumentValues: (ctx, name) => handler.argumentValues?.(ctx, name) ?? [],
      argumentError: (ctx, name, input) => handler.argumentError?.(ctx, name, input) ?? null,
      run: (ctx, args) => handler.run(ctx, args),
    };
  });
  const byId = new Map<CommandId, Command>(commands.map((c) => [c.id, c]));
  const bindings = catalogBindings(surface);
  const keymap = Object.fromEntries(
    KEY_MODES.map((mode) => [
      mode,
      bindings
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
    surface,
    commands,
    get: (id) => byId.get(id) as Command,
    keymap: () => keymap,
  };
}
