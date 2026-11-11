import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { frameToLines } from '../features/cells';
import { parsePresentArgs } from '../features/cli-args';
import { SEQ, type ProcessHooks } from '../features/screen';
import { runPresent, stubFrame, type PresentEnvironment } from './run-present';

function environment(argv: string[], isTTY: boolean) {
  const out: string[] = [];
  const err: string[] = [];
  const input = Object.assign(new EventEmitter(), { isTTY, setRawMode: () => undefined, resume: () => undefined, pause: () => undefined });
  const output = Object.assign(new EventEmitter(), { isTTY, columns: 80, rows: 24, write: (s: string) => out.push(s) });
  const hooks: ProcessHooks = { onSignal: () => () => undefined, onFatal: () => () => undefined, onExit: () => () => undefined, writeSync: (s) => out.push(s) };
  const env: PresentEnvironment = {
    argv,
    config: { env: {}, cwd: '/tmp', homedir: '/home/x', readFile: () => '', fileExists: () => false },
    input,
    output,
    hooks,
    timers: { setTimeout: (cb, ms) => setTimeout(cb, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
    stderr: (t) => err.push(t),
  };
  return { env, input, out, err };
}

describe('runPresent (skjelett)', () => {
  it('viser hjelpen og gir feilkoder for ugyldige argumenter og manglende TTY', async () => {
    expect(await runPresent(environment(['--hjelp'], true).env)).toBe(0);
    expect(await runPresent(environment(['--niva', 'h9'], true).env)).toBe(2);
    const noTty = environment(['--vault', '/tmp/vault'], false);
    expect(await runPresent(noTty.env)).toBe(1);
    expect(noTty.err.join('')).toContain('må kjøres i en terminal');
  });

  it('tegner plassholderen i alternativ buffer og gjenoppretter terminalen på q', async () => {
    const t = environment(['Statusmøte uke 45', '--vault', '/tmp/vault'], true);
    const done = runPresent(t.env);
    t.input.emit('data', 'q');
    expect(await done).toBe(0);
    expect(t.out[0]).toContain(SEQ.altScreenOn);
    expect(t.out.join('')).toContain('Statusm');
    expect(t.out.at(-1)?.endsWith(SEQ.altScreenOff)).toBe(true);
  });

  it('viser en tydelig melding under 80×24', () => {
    const lines = frameToLines(stubFrame({ cols: 60, rows: 20 }, parsePresentArgs([]), { name: 'v', root: '/v' }));
    expect(lines.join('\n')).toContain('Terminalen er for liten (60×20).');
  });
});
