import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createInlineMetaExtractor } from '../../server/features/vault-index';
import { SEQ, type ProcessHooks } from '../features/screen';
import { openTerminalVault } from '../features/vault';
import { runPresent, type PresentEnvironment } from './run-present';

const VAULT = fileURLToPath(new URL('../../../test-vault', import.meta.url));

function environment(argv: string[], isTTY: boolean, size = { columns: 120, rows: 36 }) {
  const out: string[] = [];
  const err: string[] = [];
  const input = Object.assign(new EventEmitter(), { isTTY, setRawMode: () => undefined, resume: () => undefined, pause: () => undefined });
  const output = Object.assign(new EventEmitter(), { isTTY, ...size, write: (s: string) => out.push(s) });
  const hooks: ProcessHooks = { onSignal: () => () => undefined, onFatal: () => () => undefined, onExit: () => () => undefined, writeSync: (s) => out.push(s) };
  const env: PresentEnvironment = {
    argv,
    config: { env: { TERM: 'xterm-ghostty' }, cwd: '/tmp', homedir: '/home/x', readFile: () => '', fileExists: () => false },
    input,
    output,
    hooks,
    timers: { setTimeout: (cb, ms) => setTimeout(cb, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
    stderr: (t) => err.push(t),
    openVault: (vault, options) => openTerminalVault(vault, { ...options, watch: false, createInitialExtractor: createInlineMetaExtractor }),
  };
  // eslint-disable-next-line no-control-regex -- fjerner SGR, markørflytting og OSC fra utdata
  const screen = () => out.join('').replace(/\u001b\[[0-9;:?]*[A-Za-z]|\u001b\][^\u001b]*\u001b\\/g, '');
  const waitFor = async (pattern: RegExp, timeout = 20_000) => {
    const start = Date.now();
    while (!pattern.test(screen())) {
      if (Date.now() - start > timeout) throw new Error(`Fant ikke ${pattern} i utdata`);
      await new Promise((r) => setTimeout(r, 10));
    }
  };
  return { env, input, output, out, err, screen, waitFor };
}

describe('runPresent', () => {
  it('viser hjelpen og gir feilkoder for ugyldige argumenter og manglende TTY', async () => {
    expect(await runPresent(environment(['--hjelp'], true).env)).toBe(0);
    expect(await runPresent(environment(['--niva', 'h9'], true).env)).toBe(2);
    const noTty = environment(['--vault', VAULT], false);
    expect(await runPresent(noTty.env)).toBe(1);
    expect(noTty.err.join('')).toContain('må kjøres i en terminal');
  });

  it('oppstartsskjerm, tittellysbildet, neste med j og avslutning med q', async () => {
    const t = environment(['Statusmøte', 'uke', '45', '--vault', VAULT], true);
    const done = runPresent(t.env);
    expect(t.out[0]).toContain(SEQ.altScreenOn);
    await t.waitFor(/Leser vaultet/);
    // Tittelsiden har bare starthintet, ingen folio (PO-95).
    await t.waitFor(/Presentasjon/);
    t.input.emit('data', 'j');
    // Diff-tegningen skriver bare endrede celler; en resize tegner alt på nytt.
    await new Promise((r) => setTimeout(r, 20));
    t.output.emit('resize');
    await t.waitFor(/2\/\d+/);
    t.input.emit('data', 'q');
    expect(await done).toBe(0);
    expect(t.out.at(-1)?.endsWith(SEQ.altScreenOff)).toBe(true);
  }, 30_000);

  it('ukjent notat: gjenoppretter terminalen, melding og exit 1', async () => {
    const t = environment(['xyzzy-finnes-ikke', '--vault', VAULT], true);
    expect(await runPresent(t.env)).toBe(1);
    expect(t.err.join('')).toContain('Fant ikke notatet «xyzzy-finnes-ikke»');
    expect(t.out.at(-1)?.endsWith(SEQ.altScreenOff)).toBe(true);
  }, 30_000);

  it('uten notat: notatlisten, søk og Enter presenterer', async () => {
    const t = environment(['--vault', VAULT], true);
    const done = runPresent(t.env);
    await t.waitFor(/velg notatet du vil presentere/);
    t.input.emit('data', 'Statusmøte uke 45');
    t.input.emit('data', '\r');
    await t.waitFor(/Presentasjon/);
    t.input.emit('data', '\x03');
    expect(await done).toBe(0);
  }, 30_000);

  it('--niva med et nivå notatet ikke har gir E486', async () => {
    const t = environment(['Statusmøte uke 45', '--niva', 'h6', '--vault', VAULT], true);
    expect(await runPresent(t.env)).toBe(2);
    expect(t.err.join('')).toMatch(/E486/);
  }, 30_000);

  it('for liten terminal: melding i stedet for lysbildet', async () => {
    const t = environment(['Statusmøte uke 45', '--vault', VAULT], true, { columns: 60, rows: 20 });
    const done = runPresent(t.env);
    await t.waitFor(/for liten/);
    t.input.emit('data', 'q');
    expect(await done).toBe(0);
  }, 30_000);

  it('PO-132: terminalens farger er standard (ingen 24-bits farger, bakgrunnen males ikke); --palett gir truecolor', async () => {
    const plain = environment(['Statusmøte uke 45', '--vault', VAULT], true);
    const done = runPresent(plain.env);
    await plain.waitFor(/Presentasjon/);
    plain.input.emit('data', 'q');
    expect(await done).toBe(0);
    const raw = plain.out.join('');
    expect(raw).not.toMatch(/\u001b\[[0-9;]*;(38|48);2;/);
    expect(raw).not.toMatch(/;4[0-7]m|;10[0-7]m/);

    const fosfor = environment(['Statusmøte uke 45', '--vault', VAULT, '--palett', 'fosfor'], true);
    const done2 = runPresent(fosfor.env);
    await fosfor.waitFor(/Presentasjon/);
    fosfor.input.emit('data', 'q');
    expect(await done2).toBe(0);
    expect(fosfor.out.join('')).toMatch(/48;2;11;13;10/);
  }, 30_000);
});

