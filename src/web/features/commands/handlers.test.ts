import { describe, expect, it, vi } from 'vitest';
import { createCommandHandlers, COMING_SOON, NOTES_ONLY, NO_HEADINGS } from './handlers';
import { COMMAND_IDS, createCommandRegistry, type CommandContext, type CommandPorts, type RouteKind } from './index';

function fakePorts() {
  const fn = () => vi.fn();
  return {
    scroll: { by: fn(), halfPage: fn(), toTop: fn(), toBottom: fn() },
    history: { back: fn(), forward: fn() },
    palette: { openSearch: fn(), openCommands: fn() },
    help: { openShortcuts: fn() },
    appearance: { open: fn() },
    theme: {
      resolvedMode: 'light' as const,
      toggleMode: fn(),
      setMode: fn(),
      setType: fn(),
      setPalette: fn(),
      types: [{ value: 'terminal', label: 'Terminal', current: true }],
      palettes: [{ value: 'fosfor', label: 'Fosfor' }],
    },
    view: { toggleWidth: fn(), toggleDiscreet: fn(), toggleZen: fn(), exitZen: vi.fn(() => false) },
    outline: { toggleAtReadingPosition: fn(), foldAll: fn(), unfoldAll: fn() },
    toast: fn(),
  } satisfies CommandPorts;
}

function context(kind: RouteKind = 'note', foldableHeadings = 3) {
  const ports = fakePorts();
  const ctx: CommandContext = {
    mode: 'normal',
    route: { kind, vaultId: 'test', docPath: kind === 'base' ? 'Oppgaver.base' : 'Velkommen' },
    view: { width: 'readable', discreet: false, zen: false, noteEmbeds: 0, foldableHeadings },
    ports,
  };
  return { ctx, ports };
}

describe('kommandohandlere', () => {
  const registry = createCommandRegistry(createCommandHandlers());

  it('har en handler for hver kommando i katalogen', () => {
    expect(registry.commands.map((c) => c.id)).toEqual(COMMAND_IDS);
  });

  it.each([
    ['scroll.down', (p: ReturnType<typeof fakePorts>) => expect(p.scroll.by).toHaveBeenCalledWith(3)],
    ['scroll.up', (p: ReturnType<typeof fakePorts>) => expect(p.scroll.by).toHaveBeenCalledWith(-3)],
    ['scroll.halfPageDown', (p: ReturnType<typeof fakePorts>) => expect(p.scroll.halfPage).toHaveBeenCalledWith(1)],
    ['scroll.halfPageUp', (p: ReturnType<typeof fakePorts>) => expect(p.scroll.halfPage).toHaveBeenCalledWith(-1)],
    ['scroll.top', (p: ReturnType<typeof fakePorts>) => expect(p.scroll.toTop).toHaveBeenCalled()],
    ['scroll.bottom', (p: ReturnType<typeof fakePorts>) => expect(p.scroll.toBottom).toHaveBeenCalled()],
    ['history.back', (p: ReturnType<typeof fakePorts>) => expect(p.history.back).toHaveBeenCalled()],
    ['history.forward', (p: ReturnType<typeof fakePorts>) => expect(p.history.forward).toHaveBeenCalled()],
    ['system.escape', (p: ReturnType<typeof fakePorts>) => expect(p.view.exitZen).toHaveBeenCalled()],
    ['theme.toggleMode', (p: ReturnType<typeof fakePorts>) => expect(p.theme.toggleMode).toHaveBeenCalled()],
    ['theme.light', (p: ReturnType<typeof fakePorts>) => expect(p.theme.setMode).toHaveBeenCalledWith('light')],
    ['theme.dark', (p: ReturnType<typeof fakePorts>) => expect(p.theme.setMode).toHaveBeenCalledWith('dark')],
    ['appearance.open', (p: ReturnType<typeof fakePorts>) => expect(p.appearance.open).toHaveBeenCalled()],
    ['palette.search', (p: ReturnType<typeof fakePorts>) => expect(p.palette.openSearch).toHaveBeenCalledWith()],
    ['palette.commands', (p: ReturnType<typeof fakePorts>) => expect(p.palette.openCommands).toHaveBeenCalledWith()],
    ['help.shortcuts', (p: ReturnType<typeof fakePorts>) => expect(p.help.openShortcuts).toHaveBeenCalled()],
  ] as const)('%s kaller riktig port', (id, check) => {
    const { ctx, ports } = context();
    const command = registry.get(id);
    expect(command.isEnabled(ctx)).toEqual({ enabled: true });
    void command.run(ctx, {});
    check(ports);
  });

  it('argumentkommandoer: verdier fra temaet, kjøring med og uten argument', () => {
    const { ctx, ports } = context();
    const type = registry.get('theme.setType');
    expect(type.argumentValues(ctx, 'type')).toEqual([{ value: 'terminal', label: 'Terminal', current: true }]);
    void type.run(ctx, { type: 'terminal' });
    expect(ports.theme.setType).toHaveBeenCalledWith('terminal');
    void type.run(ctx, {});
    expect(ports.palette.openCommands).toHaveBeenCalledWith('tema ');
    const palette = registry.get('theme.setPalette');
    expect(palette.argumentValues(ctx, 'palette')).toEqual([{ value: 'fosfor', label: 'Fosfor' }]);
    void palette.run(ctx, { palette: 'fosfor' });
    expect(ports.theme.setPalette).toHaveBeenCalledWith('fosfor');
    void palette.run(ctx, {});
    expect(ports.palette.openCommands).toHaveBeenCalledWith('palett ');
  });

  it('bredde og zen er levert (1.1-b)', () => {
    const { ctx, ports } = context();
    expect(registry.get('view.toggleWidth').isEnabled(ctx)).toEqual({ enabled: true });
    void registry.get('view.toggleWidth').run(ctx, {});
    expect(ports.view.toggleWidth).toHaveBeenCalled();
    void registry.get('view.toggleZen').run(ctx, {});
    expect(ports.view.toggleZen).toHaveBeenCalled();
  });

  it('funksjoner fra senere slices er deaktivert med «Kommer snart»', () => {
    const { ctx } = context();
    for (const id of ['view.toggleDiscreet', 'outline.toggleSection', 'outline.foldAll', 'outline.unfoldAll'] as const) {
      expect(registry.get(id).isEnabled(ctx), id).toEqual({ enabled: false, reason: COMING_SOON });
    }
  });

  it('diskré og folding på en .base-side: «Gjelder bare notater» (før «Kommer snart»)', () => {
    const { ctx } = context('base');
    expect(registry.get('view.toggleDiscreet').isEnabled(ctx)).toEqual({ enabled: false, reason: NOTES_ONLY });
    expect(registry.get('outline.foldAll').isEnabled(ctx)).toEqual({ enabled: false, reason: NOTES_ONLY });
  });

  it('når funksjonene er levert, styres tilgjengeligheten av konteksten', () => {
    const delivered = createCommandRegistry(createCommandHandlers({ pending: new Set() }));
    const { ctx, ports } = context('note', 0);
    expect(delivered.get('view.toggleWidth').isEnabled(ctx)).toEqual({ enabled: true });
    expect(delivered.get('outline.foldAll').isEnabled(ctx)).toEqual({ enabled: false, reason: NO_HEADINGS });
    expect(delivered.get('outline.foldAll').isEnabled(context('note', 2).ctx)).toEqual({ enabled: true });
    void delivered.get('view.toggleZen').run(ctx, {});
    expect(ports.view.toggleZen).toHaveBeenCalled();
  });

  it('nå-tilstand til paletten og which-key', () => {
    const { ctx } = context();
    expect(registry.get('view.toggleWidth').state(ctx)).toBe('optimal');
    expect(registry.get('view.toggleZen').state(ctx)).toBe('av');
    expect(registry.get('view.toggleDiscreet').state(ctx)).toBe('av');
    expect(registry.get('view.toggleDiscreet').state(context('base').ctx)).toBeNull();
    expect(registry.get('theme.toggleMode').state(ctx)).toBe('lys');
    expect(registry.get('theme.setType').state(ctx)).toBe('Terminal');
    expect(registry.get('scroll.down').state(ctx)).toBeNull();
  });
});
