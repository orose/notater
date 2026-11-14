import type { ElementContent } from 'hast';
import { describe, expect, it } from 'vitest';
import { h } from '../../../core/test-support/hast';
import { inlineRuns, obsidianUrl, superscript, wrapRuns } from './inline';
import { runsText } from './rows';

const ctx = { obsidianVault: 'Arbeid', plainInlineCode: false };
type Child = ElementContent | string;
const span = (...c: Child[]) => [h('span', {}, ...c)];
const lines = (nodes: Child[], w: number) => wrapRuns(inlineRuns(span(...nodes), ctx), w).map(runsText);

describe('inline og bryting (designsystem-terminal §4.1)', () => {
  it('stiler: fet, kursiv, gjennomstreket, markering, inline-kode og fotnotehenvisning', () => {
    const runs = inlineRuns(span(h('strong', {}, 'fet'), ' ', h('em', {}, 'kursiv'), ' ', h('del', {}, 'x'), ' ', h('mark', {}, 'm'), ' ', h('code', {}, 'k o'), h('sup', {}, h('a', { dataFootnoteRef: true }, '12'))), ctx);
    expect(runs.find((r) => r.text === 'fet')?.style.bold).toBe(true);
    expect(runs.find((r) => r.text === 'kursiv')?.style.italic).toBe(true);
    expect(runs.find((r) => r.text === 'x')?.style.strike).toBe(true);
    expect(runs.find((r) => r.text === 'm')?.style.bg).toBe('treff_bg');
    expect(runs.find((r) => r.text === 'k o')).toMatchObject({ chip: true, style: { bg: 'flate_bg' } });
    expect(runs.at(-1)).toMatchObject({ text: '¹²', style: { fg: 'aksent', bold: true } });
    expect(superscript('3')).toBe('³');
  });

  it('lenker: intern til obsidian:// (PO-109/117), ekstern til URL, brutt med prikket understrek uten mål', () => {
    const runs = inlineRuns([
      h('a', { dataVrLink: 'internal', dataVrTarget: 'domene/Kunde' }, 'Kunde'),
      h('a', { dataVrLink: 'external', href: 'https://example.com' }, 'ex'),
      h('a', { dataVrLink: 'unresolved' }, 'borte'),
    ], ctx);
    expect(runs[0]!.style).toMatchObject({ fg: 'lenke', underline: true, link: 'obsidian://open?vault=Arbeid&file=domene%2FKunde' });
    expect(runs[1]!.style.link).toBe('https://example.com');
    expect(runs[2]!.style).toMatchObject({ fg: 'lenke_brutt', dotted: true });
    expect(runs[2]!.style.link).toBeUndefined();
    expect(obsidianUrl('Mitt vault', 'a/b c')).toBe('obsidian://open?vault=Mitt%20vault&file=a%2Fb%20c');
  });

  it('ord på tvers av stiler brytes samlet; lange ord deles hardt uten tap; br bryter', () => {
    expect(lines(['Se (', h('code', {}, 'pg_advisory_lock'), ').'], 12)).toEqual(['Se', '(pg_advisory', '_lock).']);
    expect(lines(['aaa bbb ccc'], 7)).toEqual(['aaa bbb', 'ccc']);
    expect(lines(['abcdefghij'], 4).join('')).toBe('abcdefghij');
    expect(lines(['én', h('br'), 'to'], 20)).toEqual(['én', 'to']);
    expect(lines(['a b c'], 3)).toEqual(['a b', 'c']);
  });
});
