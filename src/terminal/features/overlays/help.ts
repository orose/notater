// Hjelpen `?` (designsystem-terminal §5.4): flytevindu med runde hjørner midt på, lysbildet bak dempet. Innholdet er
// katalogens `?`-grupper for flaten «terminal» (AR-3-22).

import { shortcutGroups } from '../../../core/commands';
import { textWidth, type Frame } from '../cells';
import { createCanvas, type Canvas } from '../draw';
import type { StyleSpec, TerminalTheme } from '../theme';

/** Demper alt i rammen til `dekor` (lysbildet bak et flytevindu). */
export function dimFrame(frame: Frame, theme: TerminalTheme): Frame {
  const fg = theme.style({ fg: 'dekor' }).fg;
  return { ...frame, cells: frame.cells.map((c) => ({ ...c, style: { fg, bg: c.style.bg } })) };
}

/** Flytevindu: runde hjørner i `strek`, flate i `flate_bg`, tittel fet i toppstreken og hint dempet til høyre. */
export function paintFloat(canvas: Canvas, x: number, y: number, w: number, h: number, title: string, hint?: string): void {
  canvas.fill(x, y, w, h, 'flate_bg');
  const frame: StyleSpec = { fg: 'strek', bg: 'flate_bg' };
  canvas.put(x, y, `╭${'─'.repeat(w - 2)}╮`, frame);
  canvas.put(x + 2, y, ` ${title} `, { bold: true, bg: 'flate_bg' });
  if (hint) canvas.put(x + w - 3 - textWidth(hint) - 1, y, ` ${hint} `, { fg: 'dempet', bg: 'flate_bg' });
  for (let k = 1; k < h - 1; k++) {
    canvas.put(x, y + k, '│', frame);
    canvas.put(x + w - 1, y + k, '│', frame);
  }
  canvas.put(x, y + h - 1, `╰${'─'.repeat(w - 2)}╯`, frame);
}

export function helpView(background: Frame, theme: TerminalTheme): Frame {
  const frame = dimFrame(background, theme);
  const canvas = createCanvas(frame, theme, 'bg', false);
  const groups = shortcutGroups('other', 'present', 'terminal');
  const lines: Array<{ keys: string; label: string } | { group: string } | null> = [];
  for (const g of groups) {
    if (lines.length > 0) lines.push(null);
    lines.push({ group: g.label });
    for (const r of g.rows) lines.push({ keys: r.bindings.map((b) => b.keys).join('  '), label: r.label });
    if (g.commandOnly.length > 0) lines.push({ keys: g.commandOnly.map((c) => `:${c}`).join(' '), label: 'som kommando' });
  }
  // For lav terminal: tipsradene (komponentenes egne taster) og tomme rader viker før noe annet.
  if (lines.length + 2 > frame.rows - 2) {
    const hints = new Set(groups.flatMap((g) => g.rows.filter((r) => r.kind === 'hint').map((r) => r.label)));
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (l === null || (l && 'label' in l && hints.has(l.label))) lines.splice(i, 1);
    }
  }
  const lw = Math.max(...lines.map((l) => (l && 'label' in l ? textWidth(l.label) : l && 'group' in l ? textWidth(l.group) : 0)));
  // Tastene får plassen de trenger; forklaringen kuttes heller (alle tastene skal kunne leses, AK-3-08).
  const kw = Math.min(Math.max(...lines.map((l) => (l && 'keys' in l ? textWidth(l.keys) : 0))), Math.max(20, frame.cols - 12 - Math.min(lw, 30)));
  const w = Math.min(frame.cols - 4, kw + lw + 8);
  const h = Math.min(frame.rows - 2, lines.length + 2);
  const x = Math.floor((frame.cols - w) / 2);
  const y = Math.floor((frame.rows - h) / 2);
  paintFloat(canvas, x, y, w, h, 'Hurtigtaster', '? lukker');
  lines.slice(0, h - 2).forEach((l, k) => {
    if (!l) return;
    if ('group' in l) canvas.put(x + 2, y + 1 + k, l.group, { fg: 'aksent', bold: true, bg: 'flate_bg' });
    else {
      canvas.put(x + 2, y + 1 + k, l.keys, { bold: true, bg: 'flate_bg' }, x + 2 + kw);
      canvas.put(x + 4 + kw, y + 1 + k, l.label, { fg: 'dempet', bg: 'flate_bg' }, x + w - 2);
    }
  });
  return canvas.frame;
}
