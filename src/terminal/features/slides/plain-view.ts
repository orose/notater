// Enkel tekstlig tegning av et lysbilde (slice 3-a): agendalinje, overskrift, innhold som ren tekst og statuslinje med
// `n/N`. Erstattes av den ekte tegningen etter designsystem-terminal.md i slice 3-b; navigasjon, kortstokk og
// statuslinjens folio er de samme.

import { textContent } from '../../../core/hast';
import type { Slide, SlideDeck } from '../../../core/presentation';
import { PLAIN, createFrame, textWidth, writeText, type CellStyle, type Frame } from '../cells';

const MUTED: CellStyle = { ...PLAIN, dim: true };
const STRONG: CellStyle = { ...PLAIN, bold: true };
const SELECTED: CellStyle = { ...PLAIN, bold: true, underline: true };

/** Grådig ordbryting; ord lengre enn linjen deles mellom tegn. */
export function wrapWords(text: string, width: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (textWidth(candidate) <= width) {
        line = candidate;
        continue;
      }
      if (line !== '') out.push(line);
      line = word;
      while (textWidth(line) > width) {
        const chars = [...line];
        out.push(chars.slice(0, width).join(''));
        line = chars.slice(width).join('');
      }
    }
    out.push(line);
  }
  return out;
}

function unitLines(slide: Slide, width: number): string[] {
  const lines: string[] = [];
  for (const unit of slide.units) {
    const text = textContent(unit.node).replace(/[ \t]+/g, ' ').trim();
    if (text === '') continue;
    const marker = unit.list ? (unit.list.tagName === 'ol' ? `${Number(unit.list.properties.start ?? 1) + unit.list.index}. ` : '– ') : '';
    const wrapped = wrapWords(text, width - textWidth(marker));
    wrapped.forEach((l, i) => lines.push(`${i === 0 ? marker : ' '.repeat(textWidth(marker))}${l}`));
    if (!unit.list) lines.push('');
  }
  return lines;
}

function agendaLine(frame: Frame, deck: SlideDeck, slide: Slide, margin: number): void {
  let x = Math.max(0, margin - 1);
  deck.agenda.forEach((item, i) => {
    const current = item.index === slide.agendaIndex;
    if (i > 0) x = writeText(frame, x, 0, ' │ ', MUTED);
    x = writeText(frame, x, 0, `${item.index + 1} `, current ? STRONG : MUTED);
    x = writeText(frame, x, 0, item.text, current ? SELECTED : MUTED);
    if (current && slide.progress) x = writeText(frame, x, 0, ` ${slide.progress.index}/${slide.progress.count}`, MUTED);
  });
}

export interface PlainViewOptions {
  readonly blackout: boolean;
}

export function plainSlideView(deck: SlideDeck, index: number, cols: number, rows: number, options: PlainViewOptions = { blackout: false }): Frame {
  const frame = createFrame(cols, rows);
  if (options.blackout) return frame;
  const slide = deck.slides[index];
  if (!slide) return frame;
  const margin = Math.max(4, Math.round(cols * 0.067));
  const width = Math.min(cols - 2 * margin, 160);
  let y = 2;
  const write = (text: string, style: CellStyle) => {
    if (y < rows - 2) writeText(frame, margin, y, text, style, margin + width);
    y += 1;
  };

  if (slide.kind === 'title') {
    y = Math.max(2, Math.round(rows * 0.38));
    for (const l of wrapWords(deck.title, width)) write(l, STRONG);
  } else if (slide.kind === 'agenda' || slide.kind === 'transition') {
    const current = slide.kind === 'transition' ? deck.agenda.find((a) => a.index === slide.agendaIndex) : null;
    write(current ? current.text : 'Agenda', STRONG);
    y += 1;
    for (const item of deck.agenda) write(`${String(item.index + 1).padStart(2, '0')}  ${item.text}${item === current ? '   ← du er her' : ''}`, item === current ? STRONG : PLAIN);
  } else {
    if (deck.agenda.length > 0 && slide.agendaIndex !== null) agendaLine(frame, deck, slide, margin);
    if (slide.agendaIndex !== null) write(`${String(slide.agendaIndex + 1).padStart(2, '0')} /`, STRONG);
    if (slide.heading) for (const l of wrapWords(slide.heading, width)) write(l, STRONG);
    y += 1;
    for (const l of unitLines(slide, width)) write(l, PLAIN);
  }

  const folio = `${slide.number}/${deck.slides.length}`;
  const hint = cols - 2 * margin >= 100 ? 'j k blar · : kommando · q avslutter' : 'q avslutter';
  writeText(frame, margin, rows - 1, deck.title, MUTED, cols - margin - textWidth(folio) - textWidth(hint) - 4);
  writeText(frame, cols - margin - textWidth(folio) - textWidth(hint) - 3, rows - 1, hint, MUTED);
  writeText(frame, cols - margin - textWidth(folio), rows - 1, folio, STRONG);
  return frame;
}
