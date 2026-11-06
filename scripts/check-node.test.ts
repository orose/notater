import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, 'check-node.js');

function run(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

describe('check-node (PO-5)', () => {
  it('godtar Node-versjonen vi kjører på', () => {
    expect(() => execFileSync(process.execPath, [script])).not.toThrow();
  });

  it.each(['22.22.0', '22.23.4', '24.1.0', '25.0.0'])('godtar %s', (version) => {
    expect(run('--simulate', version).status).toBe(0);
  });

  it.each(['18.19.0', '20.18.1', '22.21.9', '22.9.0'])('avviser %s med norsk feilmelding', (version) => {
    const result = run('--simulate', version);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Vault-leseren krever Node.js 22.22 eller nyere (du har ${version})`);
    expect(result.stderr).toContain('nvm install');
  });

  it('minstekravet stemmer med «engines» i package.json og .nvmrc', () => {
    const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')) as { engines: { node: string } };
    expect(pkg.engines.node).toBe('>=22.22.0');
    const nvmrc = readFileSync(resolve(import.meta.dirname, '../.nvmrc'), 'utf8').trim();
    expect(run('--simulate', nvmrc).status).toBe(0);
  });
});
