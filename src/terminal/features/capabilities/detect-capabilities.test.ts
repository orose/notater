import { describe, expect, it } from 'vitest';
import { detectCapabilities } from './detect-capabilities';

const ghostty = { TERM: 'xterm-ghostty', TERM_PROGRAM: 'ghostty', COLORTERM: 'truecolor' };

describe('terminalens evner (ADR-011 §3, AR-3-11)', () => {
  it('Ghostty og andre kjente terminaler: truecolor og OSC 8', () => {
    expect(detectCapabilities(ghostty, null)).toEqual({ depth: 'truecolor', hyperlinks: true });
    expect(detectCapabilities({ TERM: 'xterm-kitty' }, null)).toEqual({ depth: 'truecolor', hyperlinks: true });
    expect(detectCapabilities({ TERM: 'xterm-256color', TERM_PROGRAM: 'iTerm.app' }, null)).toEqual({ depth: 'truecolor', hyperlinks: true });
    expect(detectCapabilities({ TERM: 'xterm-256color', TERM_PROGRAM: 'WezTerm' }, null).depth).toBe('truecolor');
  });

  it('COLORTERM=24bit gir truecolor, men ikke OSC 8 alene', () => {
    expect(detectCapabilities({ TERM: 'xterm', COLORTERM: '24bit' }, null)).toEqual({ depth: 'truecolor', hyperlinks: false });
  });

  it('256color uten truecolor gir ansi256; ellers 16 farger', () => {
    expect(detectCapabilities({ TERM: 'xterm-256color' }, null).depth).toBe('ansi256');
    expect(detectCapabilities({ TERM: 'xterm' }, null).depth).toBe('ansi16');
    expect(detectCapabilities({}, null).depth).toBe('ansi16');
  });

  it('første treff vinner: --farger terminal før NO_COLOR, NO_COLOR før truecolor', () => {
    expect(detectCapabilities({ ...ghostty, NO_COLOR: '1' }, 'terminal').depth).toBe('ansi16');
    expect(detectCapabilities({ ...ghostty, NO_COLOR: '1' }, null).depth).toBe('none');
    expect(detectCapabilities({ ...ghostty, NO_COLOR: '' }, null).depth).toBe('truecolor');
    expect(detectCapabilities(ghostty, 'palett').depth).toBe('truecolor');
  });

  it('OSC 8 i VTE ≥ 0.50 og Windows Terminal', () => {
    expect(detectCapabilities({ TERM: 'xterm-256color', VTE_VERSION: '6003' }, null).hyperlinks).toBe(true);
    expect(detectCapabilities({ TERM: 'xterm-256color', VTE_VERSION: '4800' }, null).hyperlinks).toBe(false);
    expect(detectCapabilities({ TERM: 'xterm-256color', WT_SESSION: 'x' }, null).hyperlinks).toBe(true);
  });
});
