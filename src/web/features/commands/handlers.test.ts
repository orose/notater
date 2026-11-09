import { describe, expect, it, vi } from 'vitest';
import { createCommandHandlers, presentLevelError, COMING_SOON, NOTES_ONLY, NOT_ON_BASE, NO_HEADINGS } from './handlers';
import { COMMAND_IDS, NOT_WHILE_PRESENTING, ONLY_WHILE_PRESENTING, createCommandRegistry, type CommandContext, type CommandPorts, type RouteKind } from './index';

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
    presentation: {
      active: false,
      slideLevel: 3,
      storedLevel: null,
      transitions: true,
      overviewOpen: false,
      blackout: false,
      fullscreen: false,
      levels: () => [
        { level: 2, agendaLevel: null, slides: 3 },
        { level: 3, agendaLevel: 2, slides: 7 },
        { level: 4, agendaLevel: 3, slides: 10 },
      ],
      start: fn(),
      next: fn(),
      previous: fn(),
      first: fn(),
      last: fn(),
      scroll: fn(),
      toggleOverview: fn(),
      toggleBlackout: fn(),
      setTransitions: fn(),
      toggleFullscreen: fn(),
      escape: vi.fn(() => true),
      stop: fn(),
    },
    toast: fn(),
  } satisfies CommandPorts;
}

function context(kind: RouteKind = 'note', foldableHeadings = 3, mode: CommandContext['mode'] = 'normal') {
  const ports = fakePorts();
  const ctx: CommandContext = {
    mode,
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

  it('folding er levert (1.1-c): krever overskrifter', () => {
    expect(registry.get('outline.foldAll').isEnabled(context('note', 3).ctx)).toEqual({ enabled: true });
    expect(registry.get('outline.foldAll').isEnabled(context('note', 0).ctx)).toEqual({ enabled: false, reason: NO_HEADINGS });
  });

  it('en funksjon i pending vises deaktivert med «Kommer snart»', () => {
    const early = createCommandRegistry(createCommandHandlers({ pending: new Set(['discreet']) }));
    expect(early.get('view.toggleDiscreet').isEnabled(context().ctx)).toEqual({ enabled: false, reason: COMING_SOON });
  });

  it('diskré og folding på en .base-side: «Gjelder bare notater» (før «Kommer snart»)', () => {
    const { ctx } = context('base');
    expect(registry.get('view.toggleDiscreet').isEnabled(ctx)).toEqual({ enabled: false, reason: NOT_ON_BASE });
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

  it('ADR-010 §3: lese-kommandoer er av under presentasjon, present-kommandoer bare under presentasjon', () => {
    const present = context('note', 3, 'present').ctx;
    expect(registry.get('scroll.down').isEnabled(present)).toEqual({ enabled: false, reason: NOT_WHILE_PRESENTING });
    expect(registry.get('view.toggleZen').isEnabled(present)).toEqual({ enabled: false, reason: NOT_WHILE_PRESENTING });
    expect(registry.get('theme.toggleMode').isEnabled(present)).toEqual({ enabled: true });
    expect(registry.get('present.next').isEnabled(present)).toEqual({ enabled: true });
    expect(registry.get('present.next').isEnabled(context().ctx)).toEqual({ enabled: false, reason: ONLY_WHILE_PRESENTING });
    expect(registry.get('present.start').isEnabled(context('base').ctx)).toEqual({ enabled: false, reason: NOTES_ONLY });
  });

  it('system.escape: under presentasjon avslutter/lukker presentasjonen, ellers zen', () => {
    const { ctx, ports } = context('note', 3, 'present');
    void registry.get('system.escape').run(ctx, {});
    expect(ports.presentation.escape).toHaveBeenCalled();
    expect(ports.view.exitZen).not.toHaveBeenCalled();
  });

  it(':presenter: argumentverdier er auto + gyldige nivåer med beskrivelse; ugyldig/tomt nivå gir E475/E486 (PO-101)', () => {
    const { ctx, ports } = context();
    const values = registry.get('present.start').argumentValues(ctx, 'nivå');
    expect(values.map((v) => v.value)).toEqual(['auto', 'h2', 'h3', 'h4']);
    expect(values[2]?.description).toBe('agenda h2 · 7 lysbilder');
    expect(registry.get('present.start').argumentError(ctx, 'nivå', 'h9')?.code).toBe('E475');
    expect(registry.get('present.start').argumentError(ctx, 'nivå', '4')?.code).toBe('E475');
    expect(registry.get('present.start').argumentError(ctx, 'nivå', 'h5')).toMatchObject({ code: 'E486', title: 'Ingen overskrifter på nivå h5 i notatet.' });
    expect(registry.get('present.start').argumentError(ctx, 'nivå', 'h5')?.detail).toContain('Gyldige nivåer: h2, h3 og h4.');
    void registry.get('present.start').run(ctx, { nivå: 'h4' });
    expect(ports.presentation.start).toHaveBeenCalledWith(4);
    void registry.get('present.start').run(ctx, {});
    expect(ports.presentation.start).toHaveBeenLastCalledWith();
    void registry.get('present.start').run(ctx, { nivå: 'h5' });
    expect(ports.presentation.start).toHaveBeenCalledTimes(2);
  });

  it('presentLevelError: auto og gyldige nivåer er ingen feil', () => {
    expect(presentLevelError('auto', [2])).toBeNull();
    expect(presentLevelError('H2', [2])).toBeNull();
    expect(presentLevelError('h1', [2, 3])?.code).toBe('E486');
    expect(presentLevelError('hx', [])?.detail).toContain('Notatet har ingen overskrifter.');
  });

  it(':agenda av/på/veksle', () => {
    const { ctx, ports } = context('note', 3, 'present');
    void registry.get('present.agenda').run(ctx, { verdi: 'av' });
    expect(ports.presentation.setTransitions).toHaveBeenLastCalledWith(false);
    void registry.get('present.agenda').run(ctx, {});
    expect(ports.presentation.setTransitions).toHaveBeenLastCalledWith(false);
    void registry.get('present.agenda').run(ctx, { verdi: 'på' });
    expect(ports.presentation.setTransitions).toHaveBeenLastCalledWith(true);
  });
});
