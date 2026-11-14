import { describe, expect, it } from 'vitest';
import { COMMAND_IDS } from './catalog';
import type { CommandContext, CommandPorts } from './command-context';
import { commandPaletteOptions, paletteArgumentError } from './palette-options';
import { createCommandRegistry, surfaceCommandIds, type CommandHandlers } from './registry';

const TYPES = [
  { value: 'tidsskrift', label: 'Tidsskrift', current: true },
  { value: 'terminal', label: 'Terminal' },
  { value: 'klartekst', label: 'Klartekst' },
];

function registry() {
  const handlers = Object.fromEntries(COMMAND_IDS.map((id) => [id, { run: () => {} }])) as unknown as Record<string, unknown>;
  handlers['theme.setType'] = { run: () => {}, argumentValues: () => TYPES };
  handlers['present.start'] = {
    run: () => {},
    argumentValues: () => ['auto', 'h2', 'h3', 'h4'].map((v) => ({ value: v, label: v })),
    argumentError: (_c: unknown, _n: string, input: string) => ({ code: input === 'h5' ? 'E486' : 'E475', title: input, detail: '' }),
  };
  handlers['view.toggleZen'] = { run: () => {}, isEnabled: () => ({ enabled: false, reason: 'Kommer snart' }) };
  return createCommandRegistry('web', handlers as unknown as CommandHandlers);
}

const ctx = {
  mode: 'normal',
  route: { kind: 'note', vaultId: 't', docPath: 'a' },
  view: { width: 'readable', discreet: false, zen: false, noteEmbeds: 0, foldableHeadings: 0 },
  ports: {} as CommandPorts,
} satisfies CommandContext;

const options = (q: string) => commandPaletteOptions(registry().commands, ctx, q, 'other');

describe('commandPaletteOptions', () => {
  it('tom spørring gir alle kommandoer gruppert: Visning, Lesing, Presentasjon, Søk og kommandoer, Navigasjon', () => {
    const all = options('');
    expect([...all.map((o) => o.commandId)].sort()).toEqual([...surfaceCommandIds('web')].sort());
    const groups = all.map((o) => (o.kind === 'command' ? o.group : null));
    expect([...new Set(groups)]).toEqual(['visning', 'lesing', 'presentasjon', 'sok', 'navigasjon']);
    expect(all[0]?.commandId).toBe('view.toggleWidth');
  });

  it('viser best treffende alias som :-ord med utheving, og argumentets plassholder', () => {
    const fold = options('utf')[0];
    expect(fold).toMatchObject({ kind: 'command', commandId: 'outline.unfoldAll', ex: 'utfold', exHighlights: [[0, 3]] });
    const tema = options('').find((o) => o.commandId === 'theme.setType');
    expect(tema).toMatchObject({ ex: 'tema', argumentLabel: 'typesett' });
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

  it('valgfritt argument: Enter på `:presenter` kjører (ingen utfylling); prefiks-treff (`4` treffer ikke `h4`)', () => {
    const presenter = options('presenter')[0];
    expect(presenter).toMatchObject({ commandId: 'present.start', needsArgument: false, completion: null });
    expect(options('presenter h4').map((o) => (o.kind === 'argument' ? o.value.value : o.commandId))).toEqual(['h4']);
    expect(options('presenter h').map((o) => (o.kind === 'argument' ? o.value.value : null))).toEqual(['h2', 'h3', 'h4']);
    expect(options('presenter 4')).toEqual([]);
    expect(paletteArgumentError(registry().commands, ctx, 'presenter 4')?.code).toBe('E475');
    expect(paletteArgumentError(registry().commands, ctx, 'presenter h5')?.code).toBe('E486');
    expect(paletteArgumentError(registry().commands, ctx, 'presenter h4')).toBeNull();
    expect(paletteArgumentError(registry().commands, ctx, 'tema x')).toBeNull();
  });
});
