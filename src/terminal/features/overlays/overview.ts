// Oversikten `o` (designsystem-terminal §5.1): en liste over lysbildene, ikke miniatyrer. Nå-merke, markørrad
// ensfarget med `▌`, innholdet til høyre, statuslinje med merket OVERSIKT.

import { CONTINUED_SUFFIX, type Slide, type SlideDeck } from '../../../core/presentation';
import { createFrame, textWidth, type Frame } from '../cells';
import { createCanvas } from '../draw';
import { gridFor, paintStatusLine } from '../slides';
import type { StyleSpec, TerminalTheme } from '../theme';

/** Hva lysbildet inneholder, til høyre i oversikten (`kode · tabell · plassholder`). */
export function slideContents(slide: Slide): string {
  const kinds = new Set<string>();
  for (const u of slide.units) {
    if (u.node.type !== 'element') continue;
    const tag = u.node.tagName;
    if (tag === 'vr-code' || tag === 'pre') kinds.add('kode');
    else if (tag === 'table') kinds.add('tabell');
    else if (tag === 'vr-base') kinds.add('base');
    else if (tag === 'vr-callout') kinds.add('callout');
    else if (tag === 'vr-mermaid' || tag === 'img') kinds.add('plassholder');
    else if (tag === 'ul' || tag === 'ol' || u.list) kinds.add('liste');
  }
  return [...kinds].join(' · ');
}

function label(slide: Slide, deck: SlideDeck): string {
  if (slide.kind === 'title') return deck.title;
  if (slide.kind === 'agenda') return 'Agenda';
  if (slide.kind === 'transition') return deck.agenda.find((a) => a.index === slide.agendaIndex)?.text ?? 'Overgang';
  return slide.heading ?? deck.title;
}

export function overviewView(deck: SlideDeck, current: number, cursor: number, cols: number, rows: number, theme: TerminalTheme): Frame {
  const frame = createFrame(cols, rows);
  const canvas = createCanvas(frame, theme);
  const grid = gridFor(cols, rows);
  let y = grid.top;
  canvas.put(grid.x, y, 'Oversikt', { bold: true });
  canvas.put(grid.x + 10, y, `${deck.slides.length} lysbilder · ${deck.agenda.length} punkter`, { fg: 'dempet' });
  y += 2;
  const listTop = y;
  const visible = Math.max(1, grid.status - 1 - listTop);
  const top = Math.max(0, Math.min(cursor - Math.floor(visible / 2), deck.slides.length - visible));
  const nw = String(deck.slides.length).length;
  deck.slides.slice(top, top + visible).forEach((slide, k) => {
    const i = top + k;
    const yy = listTop + k;
    const selected = i === cursor;
    const sel = (s: StyleSpec): StyleSpec => (selected ? { ...s, fg: 'markor_tekst', bg: 'markor_bg' } : s);
    if (selected) {
      canvas.fill(grid.x - 1, yy, grid.sats + 2, 1, 'markor_bg');
      canvas.put(grid.x - 2, yy, '▌', { fg: 'fokus' });
    }
    canvas.put(grid.x, yy, String(slide.number).padStart(nw), sel({ fg: 'aksent', bold: true }));
    let x = grid.x + nw + 2;
    const heading = label(slide, deck);
    const continued = heading.endsWith(CONTINUED_SUFFIX);
    const base = continued ? heading.slice(0, -CONTINUED_SUFFIX.length) : heading;
    if (slide.kind === 'content') {
      canvas.put(x, yy, '│', sel({ fg: 'dekor' }));
      x += 4;
      x = canvas.put(x, yy, base, sel({}), grid.x + grid.sats - 30);
      if (continued) x = canvas.put(x + 1, yy, '(forts.)', sel({ fg: 'dempet' }));
    } else {
      const prefix = slide.kind === 'transition' && slide.agendaIndex !== null ? `${String(slide.agendaIndex + 1).padStart(2, '0')}  ` : '';
      x = canvas.put(x, yy, `${prefix}${base}`, sel({ bold: true }), grid.x + grid.sats - 30);
    }
    if (i === current) canvas.put(x + 2, yy, ' NÅ ', { fg: 'invertert_tekst', bg: 'aksent', bold: true });
    const contents = slideContents(slide);
    if (contents) canvas.put(grid.x + grid.sats - textWidth(contents), yy, contents, sel({ fg: 'dempet' }));
  });
  paintStatusLine(canvas, grid, deck, current, { mode: 'OVERSIKT', hint: [['j k', 'flytter'], ['↵', 'hopper'], ['Esc', 'lukker']] });
  return frame;
}
