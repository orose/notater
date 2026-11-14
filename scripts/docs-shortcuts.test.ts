import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shortcutGroups } from '../src/core/commands';
import { README_PATH, updateReadme } from './docs-shortcuts';

describe('docs:shortcuts (AK-1.1-07)', () => {
  it('README.md er i sync med kommandoregisteret – kjør npm run docs:shortcuts hvis denne feiler', () => {
    const readme = readFileSync(README_PATH, 'utf8');
    expect(updateReadme(readme), 'README.md er utdatert: kjør npm run docs:shortcuts').toBe(readme);
  });

  it('README-tabellen har samme rader som ?-kortet (par slått sammen, PO-69)', () => {
    const readme = readFileSync(README_PATH, 'utf8');
    const section = readme.slice(readme.indexOf('<!-- hurtigtaster:start -->'), readme.indexOf('<!-- hurtigtaster:end -->'));
    const rows = section.split('\n').filter((l) => /^\|.*\|\s*$/.test(l) && !/^\|\s*-/.test(l));
    const cardRows = shortcutGroups('docs').flatMap((g) => g.rows.filter((r) => r.kind === 'command'));
    expect(rows.length - 1).toBe(cardRows.length);
  });

  it('README-tabellen «I presentasjon» har samme rader som ?-kortet i present-modus (ADR-010 §3)', () => {
    const readme = readFileSync(README_PATH, 'utf8');
    const section = readme.slice(readme.indexOf('<!-- hurtigtaster-presentasjon:start -->'), readme.indexOf('<!-- hurtigtaster-presentasjon:end -->'));
    const rows = section.split('\n').filter((l) => /^\|.*\|\s*$/.test(l) && !/^\|\s*-/.test(l));
    const cardRows = shortcutGroups('docs', 'present').flatMap((g) => g.rows.filter((r) => r.kind === 'command'));
    expect(rows.length - 1).toBe(cardRows.length);
    expect(section).toContain('| Presentasjon |');
    expect(section).not.toContain('Space w');
  });

  it('erstatter bare innholdet mellom markørene', () => {
    const out = updateReadme('før\n<!-- hurtigtaster:start -->\ngammelt\n<!-- hurtigtaster:end -->\netter');
    expect(out.startsWith('før\n<!-- hurtigtaster:start -->\n| Gruppe | Taster | Kommando |')).toBe(true);
    expect(out.endsWith('<!-- hurtigtaster:end -->\netter')).toBe(true);
    expect(out).not.toContain('gammelt');
    expect(updateReadme(out)).toBe(out);
  });

  it('feiler tydelig uten markører', () => {
    expect(() => updateReadme('ingen markører')).toThrow(/mangler markørene/);
  });
});
