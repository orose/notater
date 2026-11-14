import { describe, expect, it } from 'vitest';
import { RESERVED_NORMAL_KEYS, validateBindings } from '../keyboard';
import { COMMAND_CATALOG, COMMAND_IDS } from './catalog';
import { SURFACES, type Surface } from './command-types';
import { catalogBindings, createCommandRegistry, surfaceCommandIds, type CommandHandlers } from './registry';
import { renderShortcutsMarkdown, shortcutGroups } from './shortcut-docs';

describe('kommandokatalogen v1.1', () => {
  it('AK-1.1-08: ingen reserverte (P4) eller ⌥-avhengige (P5) taster, entydig tastaturkart', () => {
    expect(validateBindings(catalogBindings())).toEqual([]);
    // P4 gjelder første akkord i normal-modus (AR-1.1-07, PO-84).
    const firstKeys = catalogBindings().filter((b) => b.mode === 'normal').map((b) => b.keys.split(' ')[0]);
    for (const reserved of RESERVED_NORMAL_KEYS) expect(firstKeys).not.toContain(reserved);
  });

  it('har spesifikasjonens tastaturkart', () => {
    const keys = Object.fromEntries(COMMAND_IDS.map((id) => [id, catalogBindings().filter((b) => b.commandId === id && b.mode === 'normal').map((b) => b.keys)]));
    expect(keys['palette.search']).toEqual(['Mod+k', '/']);
    expect(keys['palette.commands']).toEqual([':']);
    expect(keys['help.shortcuts']).toEqual(['?']);
    expect(keys['scroll.top']).toEqual(['g g']);
    expect(keys['outline.toggleSection']).toEqual(['z a']);
    expect(keys['view.toggleDiscreet']).toEqual(['Leader d']);
    expect(keys['theme.toggleMode']).toEqual(['Leader m', 'Mod+.']);
  });

  it('v2 present-modus: spesifikasjonens tabell, Space er en vanlig tast, ingen leader (ADR-010 §3, PO-88, PO-94)', () => {
    const present = (id: string) => catalogBindings().filter((b) => b.commandId === id && b.mode === 'present').map((b) => b.keys);
    expect(present('present.next')).toEqual(['j', 'ArrowRight', 'n', 'Space', 'PageDown']);
    expect(present('present.previous')).toEqual(['k', 'ArrowLeft', 'p', 'PageUp']);
    expect(present('present.first')).toEqual(['g g']);
    expect(present('present.last')).toEqual(['G']);
    expect(present('present.overview')).toEqual(['o']);
    expect(present('present.blackout')).toEqual(['b', '.']);
    expect(present('present.fullscreen')).toEqual(['f']);
    expect(present('present.scrollDown')).toEqual(['ArrowDown']);
    expect(present('palette.commands')).toEqual([':']);
    expect(present('help.shortcuts')).toEqual(['?']);
    expect(present('system.escape')).toEqual(['Escape']);
    expect(present('theme.toggleMode')).toEqual(['Mod+.']);
    expect(catalogBindings().filter((b) => b.mode === 'present' && b.keys.startsWith('Leader'))).toEqual([]);
    expect(catalogBindings().filter((b) => b.commandId === 'present.start').map((b) => [b.mode, b.keys])).toEqual([['normal', 'Leader p']]);
  });

  it('?-kortet i present-modus: Presentasjon først, ingen normal-modus-taster', () => {
    const groups = shortcutGroups('other', 'present');
    expect(groups[0]?.label).toBe('Presentasjon');
    const ids = groups.flatMap((g) => g.rows.flatMap((r) => r.commands.map((c) => c.id)));
    expect(ids).not.toContain('outline.toggleSection');
    expect(ids).not.toContain('view.toggleWidth');
    expect(ids).toContain('present.next');
    expect(groups[0]?.commandOnly).toEqual(['presenter', 'agenda', 'avslutt']);
    expect(groups.flatMap((g) => g.rows).filter((r) => r.kind === 'hint').map((r) => r.id)).toContain('overview.move');
  });

  it('aliaser er unike, små bokstaver og uten kolon', () => {
    const aliases = COMMAND_IDS.flatMap((id) => [...COMMAND_CATALOG[id].aliases]);
    expect(new Set(aliases).size).toBe(aliases.length);
    for (const alias of aliases) expect(alias).toMatch(/^[^:A-Z]+$/);
  });

  it('registeret bygger tastaturkart per modus og bevarer rekkefølgen', () => {
    const noop = { run: () => {} };
    const handlers = Object.fromEntries(COMMAND_IDS.map((id) => [id, noop])) as unknown as CommandHandlers;
    const registry = createCommandRegistry('web', handlers);
    expect(registry.commands.map((c) => c.id)).toEqual(surfaceCommandIds('web'));
    expect(registry.keymap().normal.find((b) => b.commandId === 'view.toggleWidth')?.chords).toEqual(['Space', 'w']);
  });

  it('AK-1.1-07: ?-oversikten har alle bundne kommandoer i fast gruppeorden', () => {
    const groups = shortcutGroups('docs');
    expect(groups.map((g) => g.label)).toEqual(['Navigasjon', 'Lesing', 'Visning', 'Søk og kommandoer', 'Presentasjon']);
    const ids = groups.flatMap((g) => g.rows.flatMap((r) => r.commands.map((c) => c.id)));
    expect([...ids].sort()).toEqual([...new Set(catalogBindings().filter((b) => b.mode === 'normal').map((b) => b.commandId))].sort());
    const search = groups.flatMap((g) => g.rows).find((r) => r.id === 'palette.search');
    expect(search?.bindings.map((b) => b.keys)).toEqual(['⌘K / Ctrl K', '/']);
  });

  it('PO-69: par slås sammen til én rad med begge kommandoene', () => {
    const rows = shortcutGroups('other').flatMap((g) => g.rows);
    const scroll = rows.find((r) => r.id === 'scroll.down');
    expect(scroll?.label).toBe('Rull ned / opp');
    expect(scroll?.description).toBe('ca. tre linjer');
    expect(scroll?.commands.map((c) => [c.id, c.name, c.bindings.map((b) => b.chords)])).toEqual([
      ['scroll.down', 'Rull ned', [['j']]],
      ['scroll.up', 'Rull opp', [['k']]],
    ]);
    expect(rows.find((r) => r.id === 'scroll.up')).toBeUndefined();
    expect(rows.find((r) => r.id === 'outline.foldAll')?.label).toBe('Fold alle / utfold alle');
    // Partneren står i samme gruppe som den første i paret.
    for (const [id, spec] of Object.entries(COMMAND_CATALOG) as [string, { pair?: string; group: string }][]) {
      if (spec.pair) expect(COMMAND_CATALOG[spec.pair as keyof typeof COMMAND_CATALOG]?.group, id).toBe(spec.group);
    }
  });

  it('?-oversikten gir én etikett per akkord, plattformriktig (PO-36)', () => {
    const rows = shortcutGroups('other').flatMap((g) => g.rows);
    const chords = (id: string) => rows.find((r) => r.id === id)?.bindings.map((b) => b.chords);
    expect(chords('view.toggleWidth')).toEqual([['Space', 'w']]);
    expect(chords('theme.toggleMode')).toEqual([['Space', 'm'], ['Ctrl .']]);
    expect(chords('palette.search')).toEqual([['Ctrl K'], ['/']]);
    expect(
      shortcutGroups('apple')
        .flatMap((g) => g.rows)
        .find((r) => r.id === 'palette.search')
        ?.bindings.map((b) => b.chords),
    ).toEqual([['⌘K'], ['/']]);
  });

  it('README: samme rader som ?-kortet (par slått sammen), tastehint som liste', () => {
    const groups = shortcutGroups('docs');
    const md = renderShortcutsMarkdown(groups);
    const tableRows = md.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|---'));
    const cardRows = groups.flatMap((g) => g.rows).filter((r) => r.kind === 'command');
    expect(tableRows.length - 1).toBe(cardRows.length);
    expect(md).toContain('| Navigasjon | `j`, `k` | Rull ned / opp |');
    expect(md).toContain('| Søk og kommandoer | `⌘K` / `Ctrl K`, `/` | Søk i notater |');
    expect(md).toContain('|  | `gg`, `G` | Til toppen / bunnen |');
    expect(md).toContain('- `Tab`: Første trykk gir «Hopp til innhold».');
  });
});

describe('flater: web og terminal (ADR-011 §6, K6)', () => {
  const noopHandlers = (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, { run: () => {} }]));
  const keysOf = (surface: Surface, mode: 'normal' | 'present', id: string) =>
    catalogBindings(surface)
      .filter((b) => b.commandId === id && b.mode === mode)
      .map((b) => b.keys);

  it('bare web: present.fullscreen, theme.setType og appearance.open; bare terminal: terminal.colors; :presenter på begge', () => {
    const web = surfaceCommandIds('web');
    const terminal = surfaceCommandIds('terminal');
    expect(terminal).toContain('present.start');
    for (const id of ['present.fullscreen', 'theme.setType', 'appearance.open'] as const) {
      expect(web).toContain(id);
      expect(terminal).not.toContain(id);
    }
    expect(terminal).toContain('terminal.colors');
    expect(web).not.toContain('terminal.colors');
    for (const id of ['theme.setPalette', 'theme.light', 'theme.dark', 'theme.toggleMode', 'present.next', 'present.stop', 'system.escape', 'palette.commands', 'help.shortcuts'] as const) {
      expect(terminal).toContain(id);
    }
    // Standard er begge flatene; rekkefølgen er katalogens.
    expect([...new Set([...web, ...terminal])].sort()).toEqual([...COMMAND_IDS].sort());
    expect(web).toEqual(COMMAND_IDS.filter((id) => (web as readonly string[]).includes(id)));
  });

  it('terminalen har v2-present-tastene pluss q og Ctrl c på present.stop; web er uendret', () => {
    expect(keysOf('terminal', 'present', 'present.stop')).toEqual(['q', 'Ctrl+c']);
    expect(keysOf('web', 'present', 'present.stop')).toEqual([]);
    expect(catalogBindings()).toEqual(catalogBindings('web'));
    for (const id of ['present.next', 'present.previous', 'present.first', 'present.last', 'present.overview', 'present.blackout', 'present.scrollDown', 'present.scrollUp', 'palette.commands', 'help.shortcuts', 'system.escape']) {
      expect(keysOf('terminal', 'present', id), id).toEqual(keysOf('web', 'present', id));
    }
    expect(keysOf('terminal', 'present', 'present.fullscreen')).toEqual([]);
  });

  it('`:q` avslutter presentasjonen på begge flatene (PO-108); `:farger` bytter terminalfarger', () => {
    expect(COMMAND_CATALOG['present.stop'].aliases).toEqual(['avslutt', 'q']);
    expect(COMMAND_CATALOG['terminal.colors'].aliases).toContain('farger');
    expect(COMMAND_CATALOG['terminal.colors'].args?.[0]?.name).toBe('farger');
  });

  it('tastepolicyen holder per flate og modus (AK-1.1-08, AK-3-08)', () => {
    for (const surface of SURFACES) expect(validateBindings(catalogBindings(surface)), surface).toEqual([]);
  });

  it('registeret per flate: bare flatens kommandoer, tastaturkart med flatens ekstra taster', () => {
    const terminal = createCommandRegistry('terminal', noopHandlers(surfaceCommandIds('terminal')) as unknown as CommandHandlers<'terminal'>);
    expect(terminal.commands.map((c) => c.id)).toEqual(surfaceCommandIds('terminal'));
    expect(terminal.keymap().present.filter((b) => b.commandId === 'present.stop').map((b) => b.chords)).toEqual([['q'], ['Ctrl+c']]);
    expect(terminal.keymap().present.find((b) => b.commandId === 'present.fullscreen')).toBeUndefined();
    const web = createCommandRegistry('web', noopHandlers(surfaceCommandIds('web')) as unknown as CommandHandlers);
    expect(web.commands.map((c) => c.id)).not.toContain('terminal.colors');
    expect(web.keymap().present.find((b) => b.commandId === 'present.stop')).toBeUndefined();
  });

  it('handlertypen krever bare flatens kommandoer (typesjekket)', () => {
    const terminal = noopHandlers(surfaceCommandIds('terminal')) as unknown as CommandHandlers<'terminal'>;
    const web = noopHandlers(surfaceCommandIds('web')) as unknown as CommandHandlers<'web'>;
    expect(terminal['terminal.colors']).toBeDefined();
    // @ts-expect-error present.fullscreen finnes ikke i terminalen
    expect(terminal['present.fullscreen']).toBeUndefined();
    // @ts-expect-error terminal.colors finnes ikke i web
    expect(web['terminal.colors']).toBeUndefined();
  });

  it('?-kortet per flate: README og web uendret, terminalen viser q og :farger', () => {
    expect(shortcutGroups('docs', 'present')).toEqual(shortcutGroups('docs', 'present', 'web'));
    const terminal = shortcutGroups('other', 'present', 'terminal');
    const stop = terminal.flatMap((g) => g.rows).find((r) => r.commands.some((c) => c.id === 'present.stop'));
    expect(stop?.bindings.map((b) => b.keys)).toEqual(['q', 'Ctrl c']);
    const ids = terminal.flatMap((g) => g.rows.flatMap((r) => r.commands.map((c) => c.id)));
    expect(ids).not.toContain('present.fullscreen');
    expect(terminal.find((g) => g.group === 'visning')?.commandOnly).toContain('farger');
    expect(shortcutGroups('other', 'present', 'web').find((g) => g.group === 'visning')?.commandOnly ?? []).not.toContain('farger');
    expect(terminal.find((g) => g.group === 'presentasjon')?.commandOnly).toEqual(['presenter', 'agenda']);
  });
});
