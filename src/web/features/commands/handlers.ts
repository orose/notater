// Handlerne for alle kommandoene i katalogen (ADR-007 §1). Når resten av appen kun via `ctx.ports`
// (AR-1.1-03), så de kan testes med falske porter. Ingen React her.
//
// Alle funksjonene i v1.1 er levert (1.1-a–d). `pending` brukes for funksjoner som registreres før de leveres:
// de vises deaktivert med begrunnelsen «Kommer snart».

import {
  ENABLED,
  type ArgumentValue,
  type Availability,
  type CommandContext,
  type CommandHandler,
  type CommandHandlers,
  presentLevelError,
} from '../../../core/commands';

/** Visningsfunksjoner fra senere slices. Fjern fra settet når funksjonen er levert. */
export type PendingFeature = 'width' | 'zen' | 'folding' | 'discreet';

export const PENDING_FEATURES: ReadonlySet<PendingFeature> = new Set<PendingFeature>();

export const COMING_SOON = 'Kommer snart';
export const NOTES_ONLY = 'Gjelder bare notater';
export const NOT_ON_BASE = 'Ikke tilgjengelig – .base-sider har ingen innebygde notater';
export const NO_HEADINGS = 'Notatet har ingen overskrifter';

const onOff = (on: boolean) => (on ? 'på' : 'av');

/** «h2, h3 og h4». */
export { presentLevelError };

function levelValues(ctx: CommandContext): ArgumentValue[] {
  const p = ctx.ports.presentation;
  const auto: ArgumentValue = { value: 'auto', label: 'auto', description: 'Lysbildenivå fra notatets overskrifter', current: p.storedLevel === null };
  return [
    auto,
    ...p.levels().map((info) => ({
      value: `h${info.level}`,
      label: `h${info.level}`,
      description: `${info.agendaLevel === null ? 'ingen agenda' : `agenda h${info.agendaLevel}`} · ${info.slides} lysbilder`,
      current: p.storedLevel === info.level,
    })),
  ];
}

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
    // Palett og dialoger lukker seg selv (motoren er inaktiv bak modal); her gjenstår zen – og presentasjonen.
    'system.escape': {
      run: ({ ports, mode }) => {
        if (mode === 'present' && ports.presentation.escape()) return;
        ports.view.exitZen();
      },
    },

    // ADR-010 §3. Modusbegrunnelsene («Bare under presentasjon» …) gir registeret ut fra `modes` i katalogen.
    'present.start': {
      isEnabled: (ctx) => (ctx.route.kind === 'note' ? ENABLED : notesOnly),
      state: ({ ports, route }) => {
        if (route.kind !== 'note') return null;
        const stored = ports.presentation.storedLevel;
        return stored === null ? 'auto' : `h${stored}`;
      },
      argumentValues: (ctx, name) => (name === 'nivå' ? levelValues(ctx) : []),
      argumentError: (ctx, name, input) => (name === 'nivå' ? presentLevelError(input, ctx.ports.presentation.levels().map((l) => l.level)) : null),
      run: ({ ports }, args) => {
        const raw = (args.nivå ?? '').trim().toLowerCase();
        if (raw === '') {
          ports.presentation.start();
          return;
        }
        const levels = ports.presentation.levels().map((l) => l.level);
        const error = presentLevelError(raw, levels);
        if (error) {
          ports.toast(`${error.code} ${error.title} ${error.detail}`);
          return;
        }
        if (raw === 'auto') {
          ports.presentation.start('auto');
          ports.toast('Lysbildenivå automatisk. Overstyringen er fjernet for dette notatet.');
          return;
        }
        ports.presentation.start(Number(raw.slice(1)));
        ports.toast(`Lysbildenivå ${raw} – husket for dette notatet i denne nettleseren. Notatet er ikke endret.`);
      },
    },
    'present.next': { run: ({ ports }) => ports.presentation.next() },
    'present.previous': { run: ({ ports }) => ports.presentation.previous() },
    'present.first': { run: ({ ports }) => ports.presentation.first() },
    'present.last': { run: ({ ports }) => ports.presentation.last() },
    'present.scrollDown': { run: ({ ports }) => ports.presentation.scroll(1) },
    'present.scrollUp': { run: ({ ports }) => ports.presentation.scroll(-1) },
    'present.overview': { state: ({ ports }) => onOff(ports.presentation.overviewOpen), run: ({ ports }) => ports.presentation.toggleOverview() },
    'present.blackout': { state: ({ ports }) => onOff(ports.presentation.blackout), run: ({ ports }) => ports.presentation.toggleBlackout() },
    'present.fullscreen': { state: ({ ports }) => onOff(ports.presentation.fullscreen), run: ({ ports }) => ports.presentation.toggleFullscreen() },
    'present.agenda': {
      state: ({ ports }) => onOff(ports.presentation.transitions),
      argumentValues: (_ctx, name) =>
        name === 'verdi'
          ? [
              { value: 'av', label: 'av', description: 'Ingen overgangslysbilder i denne presentasjonen' },
              { value: 'på', label: 'på', aliases: ['pa'], description: 'Agendaen med «du er her» før hvert agendapunkt' },
            ]
          : [],
      run: ({ ports }, args) => {
        const value = (args.verdi ?? '').trim().toLowerCase();
        const on = value === 'av' ? false : value === 'på' || value === 'pa' ? true : !ports.presentation.transitions;
        ports.presentation.setTransitions(on);
        ports.toast(on ? 'Overganger på' : 'Overganger av for denne presentasjonen (huskes ikke)');
      },
    },
    'present.stop': { run: ({ ports }) => ports.presentation.stop() },

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
