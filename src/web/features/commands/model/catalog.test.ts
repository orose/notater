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
    const ids = groups.flatMap((g) => g.rows.map((r) => r.id));
    for (const b of catalogBindings()) expect(ids).toContain(b.commandId);
    expect(groups.flatMap((g) => g.rows).find((r) => r.id === 'palette.search')?.keys).toEqual(['⌘K / Ctrl K', '/']);
  });

  it('?-oversikten gir én etikett per akkord, plattformriktig (PO-36)', () => {
    const rows = shortcutGroups('other').flatMap((g) => g.rows);
    expect(rows.find((r) => r.id === 'view.toggleWidth')?.chords).toEqual([['Space', 'w']]);
    expect(rows.find((r) => r.id === 'theme.toggleMode')?.chords).toEqual([['Space', 'm'], ['Ctrl .']]);
    expect(rows.find((r) => r.id === 'palette.search')?.chords).toEqual([['Ctrl K'], ['/']]);
    expect(shortcutGroups('apple').flatMap((g) => g.rows).find((r) => r.id === 'palette.search')?.chords).toEqual([['⌘K'], ['/']]);
  });

  it('README: én tabell med én rad per kommando med taster, tastehint som liste', () => {
    const md = renderShortcutsMarkdown(shortcutGroups('docs'));
    const tableRows = md.split('\n').filter((l) => l.startsWith('|') && !l.startsWith('|---'));
    const commands = new Set(catalogBindings().map((b) => b.commandId));
    expect(tableRows.length - 1).toBe(commands.size);
    expect(md).toContain('| Navigasjon | `j` | Rull ned |');
    expect(md).toContain('| Søk og kommandoer | `⌘K` / `Ctrl K`, `/` | Søk i notater |');
    expect(md).toContain('|  | `k` | Rull opp |');
    expect(md).toContain('- `Tab`: Første trykk gir «Hopp til innhold».');
  });
});
