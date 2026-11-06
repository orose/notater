import { describe, expect, it } from 'vitest';
import { COMMAND_IDS } from './catalog';
import type { CommandContext, CommandPorts } from './command-context';
import { commandPaletteOptions } from './palette-options';
import { createCommandRegistry, type CommandHandlers } from './registry';

const TYPES = [
  { value: 'tidsskrift', label: 'Tidsskrift', current: true },
  { value: 'terminal', label: 'Terminal' },
  { value: 'klartekst', label: 'Klartekst' },
];

function registry() {
  const handlers = Object.fromEntries(COMMAND_IDS.map((id) => [id, { run: () => {} }])) as unknown as Record<string, unknown>;
  handlers['theme.setType'] = { run: () => {}, argumentValues: () => TYPES };
  handlers['view.toggleZen'] = { run: () => {}, isEnabled: () => ({ enabled: false, reason: 'Kommer snart' }) };
  return createCommandRegistry(handlers as unknown as CommandHandlers);
}

const ctx = {
  mode: 'normal',
  route: { kind: 'note', vaultId: 't', docPath: 'a' },
  view: { width: 'readable', discreet: false, zen: false, noteEmbeds: 0, foldableHeadings: 0 },
  ports: {} as CommandPorts,
} satisfies CommandContext;

const options = (q: string) => commandPaletteOptions(registry().commands, ctx, q, 'other');

describe('commandPaletteOptions', () => {
  it('tom spørring gir alle kommandoer i katalogrekkefølge', () => {
    const all = options('');
    expect(all.map((o) => o.commandId)).toEqual(COMMAND_IDS);
  });

  it('viser første hurtigtast per akkord og plattform', () => {
    const search = options('').find((o) => o.commandId === 'palette.search');
    expect(search?.kind === 'command' && search.shortcut).toEqual(['Ctrl K']);
    const width = options('').find((o) => o.commandId === 'view.toggleWidth');
    expect(width?.kind === 'command' && width.shortcut).toEqual(['Space', 'w']);
    const top = options('').find((o) => o.commandId === 'scroll.top');
    expect(top?.kind === 'command' && top.shortcut).toEqual(['g', 'g']);
    const apple = commandPaletteOptions(registry().commands, ctx, 'søk', 'apple')[0];
    expect(apple?.kind === 'command' && apple.shortcut).toEqual(['⌘K']);
  });

  it.each([
    ['zen', 'view.toggleZen'],
    ['zn', 'view.toggleZen'],
    ['bredde', 'view.toggleWidth'],
    ['diskret', 'view.toggleDiscreet'],
    ['lys', 'theme.light'],
    ['mørk', 'theme.dark'],
    ['fold', 'outline.toggleSection'],
    ['fold alle', 'outline.foldAll'],
    ['utfold', 'outline.unfoldAll'],
    ['hjelp', 'help.shortcuts'],
    ['taster', 'help.shortcuts'],
    ['Lukk / avbryt', 'system.escape'],
  ])(':%s rangerer %s først', (q, id) => {
    expect(options(q)[0]?.commandId).toBe(id);
  });

  it('deaktiverte kommandoer vises med begrunnelse', () => {
    const zen = options('zen')[0];
    expect(zen).toMatchObject({ kind: 'command', enabled: false, reason: 'Kommer snart' });
  });

  it('kommando med argument: Enter fullfører til argumentlisten', () => {
    const tema = options('tem')[0];
    expect(tema).toMatchObject({ kind: 'command', commandId: 'theme.setType', needsArgument: true, completion: 'tema ' });
  });

  it('«tema » gir verdiene som underliste, gjeldende markert', () => {
    const args = options('tema ');
    expect(args.map((o) => (o.kind === 'argument' ? o.value.label : o.name))).toEqual(['Tidsskrift', 'Terminal', 'Klartekst']);
    expect(args[0]).toMatchObject({ kind: 'argument', current: true, argument: 'type' });
  });

  it('«tema kla» filtrerer underlisten; «typesett ter» virker også', () => {
    expect(options('tema kla').map((o) => o.kind === 'argument' && o.value.value)).toEqual(['klartekst']);
    expect(options('typesett ter')[0]).toMatchObject({ kind: 'argument', value: { value: 'terminal' } });
  });

  it('ingen treff gir tom liste', () => {
    expect(options('xqxq')).toEqual([]);
  });
});
