import { describe, expect, it } from 'vitest';
import { frameToLines } from '../cells';
import { startupView } from './startup-view';
import { isTooSmall, tooSmallView } from './too-small';

const text = (lines: string[]) => lines.join('\n');

describe('for liten terminal (designsystem-terminal §5.7)', () => {
  it('viser gjeldende størrelse og minimum, ingen annen tekst', () => {
    for (const [cols, rows] of [[79, 23], [79, 24], [80, 23], [40, 12]] as const) {
      const out = text(frameToLines(tooSmallView({ cols, rows })));
      expect(isTooSmall({ cols, rows })).toBe(true);
      expect(out).toMatch(/for liten/);
      expect(out).toMatch(new RegExp(`${cols}\\s*×\\s*${rows}`));
      expect(out).toMatch(/80\s*×\s*24/);
    }
    expect(isTooSmall({ cols: 80, rows: 24 })).toBe(false);
    expect(text(frameToLines(tooSmallView({ cols: 15, rows: 5 })))).toContain('80×24');
  });
});

describe('oppstartsskjermen (M3, PO-116)', () => {
  it('fremdrift med tusenskille; Ctrl +-hintet bare i brede terminaler', () => {
    expect(text(frameToLines(startupView({ cols: 120, rows: 36 }, { done: 1240, total: 2000 })))).toMatch(/Leser vaultet …\s+1\s240 \/ 2\s000/);
    expect(text(frameToLines(startupView({ cols: 120, rows: 36 }, { done: 0, total: null })))).not.toContain('Ctrl +');
    expect(text(frameToLines(startupView({ cols: 200, rows: 50 }, { done: 0, total: null })))).toContain('Ctrl + gir større tekst');
  });
});
