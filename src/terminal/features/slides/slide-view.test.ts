import { afterAll, describe, expect, it } from 'vitest';
import { cellAt, frameToLines, type Frame } from '../cells';
import { renderDeck, testVault } from '../../test-support/render-note';

const SIZES = [
  [80, 24],
  [120, 36],
  [200, 50],
] as const;
const NOTES = ['Statusmøte uke 45', 'Månedsrapport oktober', 'Delte lysbilder', 'Mye innhold', 'Stor kodeblokk', 'Uten overskrifter', 'Innhold før agenda', 'Langt innhold før agenda', 'Mange agendapunkter', 'Lysbildenivå', 'Terminalkanter'];

afterAll(() => testVault().close());

const text = (f: Frame) => frameToLines(f).join('\n');
const FIGLET = /[█▀▄]{3}/u;

describe('lysbildene i terminalen (designsystem-terminal §2–§4, AR-3-29)', () => {
  for (const note of NOTES) {
    for (const [cols, rows] of SIZES) {
      it(`${note} ${cols}×${rows}: invarianter og tekstsnapshot`, async () => {
        const { frames } = await renderDeck(`presentasjon/${note}`, { cols, rows });
        frames.forEach((frame, i) => {
          const lines = frameToLines(frame);
          expect(lines).toHaveLength(rows);
          // eslint-disable-next-line no-control-regex -- ingen kontrolltegn i celler
          expect(lines.join('')).not.toMatch(/[\u0000-\u001f\u007f]/u);
          for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
            const c = cellAt(frame, x, y)!;
            if (c.width === 2) expect(cellAt(frame, x + 1, y)?.width, `bredt tegn ${x},${y}`).toBe(0);
            expect(c.style.bg.kind, 'hele terminalen males').toBe('rgb');
          }
          const status = lines.at(-1)!;
          if (i === 0) expect(status).toMatch(/Presentasjon/);
          else expect(status).toMatch(new RegExp(`${i + 1}/${frames.length}$`));
        });
        await expect(frames.map((f, i) => `── ${i + 1} ${'─'.repeat(cols - 6)}\n${text(f)}`).join('\n')).toMatchFileSnapshot(`__snapshots__/${note}.${cols}x${rows}.txt`);
      }, 30_000);
    }
  }

  it('figlet bare på tittel, agenda og overgang; agendalinjen bare på innhold med agendapunkt (AK-3-03/04)', async () => {
    const { frames } = await renderDeck('presentasjon/Statusmøte uke 45', { cols: 120, rows: 36 });
    const kinds = ['title', 'agenda', 'transition', 'content', 'content', 'transition', 'content', 'content', 'transition', 'content'];
    frames.forEach((f, i) => {
      const lines = frameToLines(f);
      if (kinds[i] === 'content') {
        expect(text(f)).not.toMatch(FIGLET);
        expect(lines[0]).toMatch(/Siden sist/);
        expect(lines[0]).toMatch(/\d\/\d/);
      } else {
        expect(text(f)).toMatch(FIGLET);
        expect(lines[0]).toBe('');
      }
    });
  }, 30_000);

  it('kode har palettens kodefarger, plassholdere har spesifikasjonens tekst, interne lenker får obsidian:// (PO-109/117)', async () => {
    const { frames } = await renderDeck('presentasjon/Statusmøte uke 45', { cols: 120, rows: 36 });
    const code = frames[4]!;
    const colors = new Set(code.cells.filter((c) => c.ch.trim() !== '' && c.style.bg.kind === 'rgb').map((c) => (c.style.fg.kind === 'rgb' ? c.style.fg.rgb : -1)));
    expect(colors.size).toBeGreaterThanOrEqual(3);
    expect(text(frames[6]!)).toContain('Kanban: Kanban – vises i web-leseren');
    expect(text(frames[7]!)).toContain('Mermaid-diagram – vises i web-leseren');
    expect(text(frames[7]!)).not.toContain('-->');
    const links = frames[9]!.cells.map((c) => c.style.link).filter(Boolean);
    expect(links).toContain('obsidian://open?vault=test-vault&file=presentasjon%2FM%C3%A5nedsrapport%20oktober');
  }, 30_000);

  it('16 farger og NO_COLOR: ingen rgb-farger; statuslinjen er revers', async () => {
    for (const depth of ['ansi16', 'none'] as const) {
      const { frames } = await renderDeck('presentasjon/Statusmøte uke 45', { cols: 120, rows: 36, depth });
      for (const f of frames) expect(f.cells.some((c) => c.style.fg.kind === 'rgb' || c.style.bg.kind === 'rgb')).toBe(false);
      expect(cellAt(frames[3]!, 0, 35)?.style.inverse).toBe(true);
    }
  }, 30_000);
});
