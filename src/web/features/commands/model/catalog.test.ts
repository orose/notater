import { describe, expect, it } from 'vitest';
import { RESERVED_NORMAL_KEYS, validateBindings } from '../../keyboard';
import { COMMAND_CATALOG, COMMAND_IDS } from './catalog';
import { catalogBindings, createCommandRegistry, type CommandHandlers } from './registry';
import { renderShortcutsMarkdown, shortcutGroups } from './shortcut-docs';

describe('kommandokatalogen v1.1', () => {
  it('AK-1.1-08: ingen reserverte (P4) eller ⌥-avhengige (P5) taster, entydig tastaturkart', () => {
    expect(validateBindings(catalogBindings())).toEqual([]);
    const firstKeys = catalogBindings().map((b) => b.keys.split(' ')[0]);
    for (const reserved of RESERVED_NORMAL_KEYS) expect(firstKeys).not.toContain(reserved);
  });

  it('har spesifikasjonens tastaturkart', () => {
    const keys = Object.fromEntries(COMMAND_IDS.map((id) => [id, catalogBindings().filter((b) => b.commandId === id).map((b) => b.keys)]));
    expect(keys['palette.search']).toEqual(['Mod+k', '/']);
    expect(keys['palette.commands']).toEqual([':']);
    expect(keys['help.shortcuts']).toEqual(['?']);
    expect(keys['scroll.top']).toEqual(['g g']);
    expect(keys['outline.toggleSection']).toEqual(['z a']);
    expect(keys['view.toggleDiscreet']).toEqual(['Leader d']);
    expect(keys['theme.toggleMode']).toEqual(['Leader m', 'Mod+.']);
  });

  it('aliaser er unike, små bokstaver og uten kolon', () => {
    const aliases = COMMAND_IDS.flatMap((id) => [...COMMAND_CATALOG[id].aliases]);
    expect(new Set(aliases).size).toBe(aliases.length);
    for (const alias of aliases) expect(alias).toMatch(/^[^:A-Z]+$/);
  });

  it('registeret bygger tastaturkart per modus og bevarer rekkefølgen', () => {
    const noop = { run: () => {} };
    const handlers = Object.fromEntries(COMMAND_IDS.map((id) => [id, noop])) as unknown as CommandHandlers;
    const registry = createCommandRegistry(handlers);
    expect(registry.commands.map((c) => c.id)).toEqual(COMMAND_IDS);
    expect(registry.keymap().normal.find((b) => b.commandId === 'view.toggleWidth')?.chords).toEqual(['Space', 'w']);
  });

  it('AK-1.1-07: ?-oversikten har alle bundne kommandoer i fast gruppeorden', () => {
    const groups = shortcutGroups('docs');
    expect(groups.map((g) => g.label)).toEqual(['Navigasjon', 'Lesing', 'Visning', 'Søk og kommandoer']);
    const ids = groups.flatMap((g) => g.rows.flatMap((r) => r.commands.map((c) => c.id)));
    expect([...ids].sort()).toEqual([...new Set(catalogBindings().map((b) => b.commandId))].sort());
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
