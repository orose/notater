// Handlerne for alle kommandoene i katalogen (ADR-007 §1). Når resten av appen kun via `ctx.ports`
// (AR-1.1-03), så de kan testes med falske porter. Ingen React her.
//
// Alle funksjonene i v1.1 er levert (1.1-a–d). `pending` brukes for funksjoner som registreres før de leveres:
// de vises deaktivert med begrunnelsen «Kommer snart».

import type { CommandContext } from './model/command-context';
import { ENABLED, type Availability, type CommandHandler } from './model/command-types';
import type { CommandHandlers } from './model/registry';

/** Visningsfunksjoner fra senere slices. Fjern fra settet når funksjonen er levert. */
export type PendingFeature = 'width' | 'zen' | 'folding' | 'discreet';

export const PENDING_FEATURES: ReadonlySet<PendingFeature> = new Set<PendingFeature>();

export const COMING_SOON = 'Kommer snart';
export const NOTES_ONLY = 'Gjelder bare notater';
export const NOT_ON_BASE = 'Ikke tilgjengelig – .base-sider har ingen innebygde notater';
export const NO_HEADINGS = 'Notatet har ingen overskrifter';

const onOff = (on: boolean) => (on ? 'på' : 'av');

const coming: Availability = { enabled: false, reason: COMING_SOON };
const notesOnly: Availability = { enabled: false, reason: NOTES_ONLY };
const notOnBase: Availability = { enabled: false, reason: NOT_ON_BASE };

export interface HandlerOptions {
  readonly pending?: ReadonlySet<PendingFeature>;
}

export function createCommandHandlers({ pending = PENDING_FEATURES }: HandlerOptions = {}): CommandHandlers {
  const gate =
    (feature: PendingFeature, check?: (ctx: CommandContext) => Availability) =>
    (ctx: CommandContext): Availability => {
      const contextual = check?.(ctx) ?? ENABLED;
      if (!contextual.enabled) return contextual;
      return pending.has(feature) ? coming : ENABLED;
    };
  // Designsystem §11.9: på en .base-side forklares hvorfor diskré ikke gir mening.
  const onNote = (ctx: CommandContext): Availability => (ctx.route.kind === 'note' ? ENABLED : ctx.route.kind === 'base' ? notOnBase : notesOnly);
  const foldable = (ctx: CommandContext): Availability => {
    if (ctx.route.kind !== 'note') return notesOnly;
    // Antallet er først kjent når folding er levert (1.1-c); før det sier «Kommer snart» det som trengs.
    if (!pending.has('folding') && ctx.view.foldableHeadings === 0) return { enabled: false, reason: NO_HEADINGS };
    return ENABLED;
  };

  const folding = (run: CommandHandler['run']): CommandHandler => ({ isEnabled: gate('folding', foldable), run });

  return {
    'scroll.down': { run: ({ ports }) => ports.scroll.by(3) },
    'scroll.up': { run: ({ ports }) => ports.scroll.by(-3) },
    'scroll.halfPageDown': { run: ({ ports }) => ports.scroll.halfPage(1) },
    'scroll.halfPageUp': { run: ({ ports }) => ports.scroll.halfPage(-1) },
    'scroll.top': { run: ({ ports }) => ports.scroll.toTop() },
    'scroll.bottom': { run: ({ ports }) => ports.scroll.toBottom() },
    'history.back': { run: ({ ports }) => ports.history.back() },
    'history.forward': { run: ({ ports }) => ports.history.forward() },
    // Palett og dialoger lukker seg selv (motoren er inaktiv bak modal); her gjenstår zen.
    'system.escape': {
      run: ({ ports }) => {
        ports.view.exitZen();
      },
    },

    'outline.toggleSection': folding(({ ports }) => ports.outline.toggleAtReadingPosition()),
    'outline.foldAll': folding(({ ports }) => ports.outline.foldAll()),
    'outline.unfoldAll': folding(({ ports }) => ports.outline.unfoldAll()),

    'view.toggleWidth': {
      isEnabled: gate('width'),
      state: ({ view }) => (view.width === 'full' ? 'full' : 'optimal'),
      run: ({ ports }) => ports.view.toggleWidth(),
    },
    'view.toggleDiscreet': {
      isEnabled: gate('discreet', onNote),
      state: ({ view, route }) => (route.kind === 'note' ? onOff(view.discreet) : null),
      run: ({ ports }) => ports.view.toggleDiscreet(),
    },
    'view.toggleZen': { isEnabled: gate('zen'), state: ({ view }) => onOff(view.zen), run: ({ ports }) => ports.view.toggleZen() },

    'theme.toggleMode': {
      state: ({ ports }) => (ports.theme.resolvedMode === 'dark' ? 'mørk' : 'lys'),
      run: ({ ports }) => ports.theme.toggleMode(),
    },
    'theme.light': { run: ({ ports }) => ports.theme.setMode('light') },
    'theme.dark': { run: ({ ports }) => ports.theme.setMode('dark') },
    'theme.setType': {
      state: ({ ports }) => ports.theme.types.find((t) => t.current)?.label ?? null,
      argumentValues: ({ ports }, name) => (name === 'type' ? ports.theme.types : []),
      run: ({ ports }, args) => {
        if (args.type) ports.theme.setType(args.type);
        else ports.palette.openCommands('tema ');
      },
    },
    'theme.setPalette': {
      state: ({ ports }) => ports.theme.palettes.find((p) => p.current)?.label ?? null,
      argumentValues: ({ ports }, name) => (name === 'palette' ? ports.theme.palettes : []),
      run: ({ ports }, args) => {
        if (args.palette) ports.theme.setPalette(args.palette);
        else ports.palette.openCommands('palett ');
      },
    },
    'appearance.open': { run: ({ ports }) => ports.appearance.open() },

    'palette.search': { run: ({ ports }) => ports.palette.openSearch() },
    'palette.commands': { run: ({ ports }) => ports.palette.openCommands() },
    'help.shortcuts': { run: ({ ports }) => ports.help.openShortcuts() },
  };
}
