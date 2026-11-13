// Visningsbredde i terminalceller (ADR-011 §4). Ren TS, ingen Node- eller DOM-avhengighet.
//
// Enheten er grafemklyngen (Intl.Segmenter): «Ä» skrevet som A + U+0308, «👩‍💻» (ZWJ) og «🇳🇴» (to regionale
// indikatorer) er hver én klynge. Bredden er 0, 1 eller 2 celler:
//   - 2: emoji med emojipresentasjon (eller VS16), regionale flagg, øst-asiatisk «Wide»/«Fullwidth».
//   - 0: kontrolltegn og rene kombinerende tegn uten base.
//   - 1: alt annet – også East Asian «Ambiguous» (rammetegn, blokktegn), som i vestlige terminaler (Ghostty).
// Wide/Fullwidth kommer fra `get-east-asian-width` (Unicode-tabellen, i `dependencies` etter PO-111).

import { eastAsianWidthType } from 'get-east-asian-width';

export type CellWidth = 0 | 1 | 2;

const segmenter = new Intl.Segmenter('nb', { granularity: 'grapheme' });

// eslint-disable-next-line no-control-regex -- terminalens kontrollsekvenser
const CONTROL = /^[\u0000-\u001f\u007f-\u009f]$/u;
const MARK_ONLY = /^\p{M}+$/u;
const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const REGIONAL = /\p{Regional_Indicator}/u;
const VS16 = '\ufe0f';
const ZWJ = '\u200d';

/** Wide/Fullwidth etter Unicode EastAsianWidth (`get-east-asian-width`, AR-3-13, PO-111). Ambiguous = 1. */
function isWideCodePoint(cp: number): boolean {
  const type = eastAsianWidthType(cp);
  return type === 'wide' || type === 'fullwidth';
}

/** Grafemklynger i lesefølge. */
export function graphemes(text: string): string[] {
  const out: string[] = [];
  for (const { segment } of segmenter.segment(text)) out.push(segment);
  return out;
}

/** Bredden til én grafemklynge. */
export function graphemeWidth(grapheme: string): CellWidth {
  if (grapheme === '' || CONTROL.test(grapheme) || MARK_ONLY.test(grapheme)) return 0;
  if (REGIONAL.test(grapheme)) return 2;
  if (PICTOGRAPHIC.test(grapheme) && (EMOJI_PRESENTATION.test(grapheme) || grapheme.includes(VS16) || grapheme.includes(ZWJ))) return 2;
  const cp = grapheme.codePointAt(0) ?? 0;
  return isWideCodePoint(cp) ? 2 : 1;
}

/** Bredden til en tekst uten escape-sekvenser (stil ligger i cellemodellen, aldri i strengene). */
export function textWidth(text: string): number {
  let width = 0;
  for (const g of graphemes(text)) width += graphemeWidth(g);
  return width;
}
