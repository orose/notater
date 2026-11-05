/**
 * Forbehandling av Obsidian-markdown før micromark/remark:
 *
 * 1. `%%kommentarer%%` fjernes (inline og blokk). Uavsluttet `%%` skjuler resten av dokumentet,
 *    slik Obsidian gjør.
 * 2. Escapede tegn som starter Obsidian-syntaks (`\[`, `\=`, `\#`, `\!`) får en usynlig vaktpost
 *    etter seg. micromark fjerner backslashen, men vaktposten hindrer at teksten senere tolkes som
 *    wikilink/markering/tagg. Vaktpostene fjernes igjen etter parsing (`stripSentinels`).
 *
 * Skanneren er kode-bevisst: inngjerdede kodeblokker (``` og ~~~, også inne i blokksitater/lister)
 * og inline-kode røres ikke.
 */

/** Unicode «private use»-tegn som aldri forekommer i vanlig tekst. */
export const ESCAPE_SENTINEL = '';

const ESCAPABLE_SYNTAX = new Set(['[', '=', '#', '!']);
const FENCE_OPEN = /^((?:[ \t]*>)*[ \t]*(?:(?:[-+*]|\d{1,9}[.)])[ \t]+)*)(`{3,}|~{3,})/;

interface FenceState {
  readonly char: string;
  readonly length: number;
}

export function preprocessObsidian(source: string): string {
  let out = '';
  let fence: FenceState | null = null;
  let i = 0;
  let atLineStart = true;

  while (i < source.length) {
    if (atLineStart) {
      const lineEnd = indexOrEnd(source, '\n', i);
      const line = source.slice(i, lineEnd);
      if (fence) {
        if (isFenceClose(line, fence)) fence = null;
        out += source.slice(i, lineEnd + 1);
        i = lineEnd + 1;
        continue;
      }
      const open = FENCE_OPEN.exec(line);
      if (open && !(open[2]!.startsWith('`') && line.slice(open[0].length).includes('`'))) {
        fence = { char: open[2]![0]!, length: open[2]!.length };
        out += source.slice(i, lineEnd + 1);
        i = lineEnd + 1;
        continue;
      }
      atLineStart = false;
    }

    const ch = source[i]!;
    if (ch === '\n') {
      out += ch;
      i += 1;
      atLineStart = true;
      continue;
    }
    if (ch === '\\') {
      const next = source[i + 1];
      if (next === '\\') {
        out += '\\\\';
        i += 2;
        continue;
      }
      if (next !== undefined && ESCAPABLE_SYNTAX.has(next)) {
        out += `\\${next}${ESCAPE_SENTINEL}`;
        i += 2;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '`') {
      const runLength = countRun(source, i, '`');
      const closing = findClosingBacktickRun(source, i + runLength, runLength);
      if (closing === -1) {
        out += source.slice(i, i + runLength);
        i += runLength;
      } else {
        out += source.slice(i, closing + runLength);
        i = closing + runLength;
      }
      continue;
    }
    if (ch === '%' && source[i + 1] === '%') {
      const end = source.indexOf('%%', i + 2);
      if (end === -1) return out;
      i = end + 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

export function stripSentinels(value: string): string {
  return value.includes(ESCAPE_SENTINEL) ? value.split(ESCAPE_SENTINEL).join('') : value;
}

function indexOrEnd(text: string, needle: string, from: number): number {
  const idx = text.indexOf(needle, from);
  return idx === -1 ? text.length : idx;
}

function countRun(text: string, from: number, char: string): number {
  let n = 0;
  while (text[from + n] === char) n += 1;
  return n;
}

/** Finn en avsluttende backtick-sekvens med nøyaktig samme lengde, innen samme avsnitt. */
function findClosingBacktickRun(text: string, from: number, length: number): number {
  let i = from;
  while (i < text.length) {
    if (text[i] === '\n' && /^\n[ \t]*\n/.test(text.slice(i, i + 64))) return -1;
    if (text[i] === '`') {
      const run = countRun(text, i, '`');
      if (run === length) return i;
      i += run;
      continue;
    }
    i += 1;
  }
  return -1;
}

function isFenceClose(line: string, fence: FenceState): boolean {
  const stripped = line.replace(/^(?:[ \t]*>)*[ \t]*/, '');
  const run = countRun(stripped, 0, fence.char);
  return run >= fence.length && stripped.slice(run).trim() === '';
}
