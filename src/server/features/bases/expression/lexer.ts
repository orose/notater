/** Uttrykksspråket for Bases (ADR-003): tekst → tokens. Rent, ingen avhengigheter. */

export type TokenKind = 'number' | 'string' | 'ident' | 'op' | 'punct' | 'eof';

export interface Token {
  readonly kind: TokenKind;
  /** Kildeteksten for tokenet (for strenger: inkludert anførselstegn). */
  readonly text: string;
  /** Tolket verdi for `number` og `string`. */
  readonly value?: number | string;
  /** Posisjon (0-basert) i uttrykket. Meldinger viser 1-basert posisjon. */
  readonly start: number;
}

/** Syntaksfeil i et uttrykk. Meldingen er norsk og kan vises til brukeren. */
export class ExpressionSyntaxError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = 'ExpressionSyntaxError';
  }
}

const TWO_CHAR_OPS = new Set(['==', '!=', '<=', '>=', '&&', '||']);
const ONE_CHAR_OPS = new Set(['<', '>', '!', '+', '-', '*', '/', '%']);
const PUNCT = new Set(['(', ')', '[', ']', ',', '.']);
const IDENT_START = /[\p{L}_$]/u;
const IDENT_PART = /[\p{L}\p{N}_$]/u;
const DIGIT = /[0-9]/;
const ESCAPES: Readonly<Record<string, string>> = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '0': '\0' };

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const start = i;
    if (DIGIT.test(ch) || (ch === '.' && DIGIT.test(source[i + 1] ?? ''))) {
      const match = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(i))!;
      tokens.push({ kind: 'number', text: match[0], value: Number(match[0]), start });
      i += match[0].length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const { value, end } = readString(source, i);
      tokens.push({ kind: 'string', text: source.slice(start, end), value, start });
      i = end;
      continue;
    }
    if (IDENT_START.test(ch)) {
      let end = i + 1;
      while (end < source.length && IDENT_PART.test(source[end]!)) end++;
      tokens.push({ kind: 'ident', text: source.slice(i, end), start });
      i = end;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      tokens.push({ kind: 'op', text: two, start });
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.has(ch)) {
      tokens.push({ kind: 'op', text: ch, start });
      i++;
      continue;
    }
    if (PUNCT.has(ch)) {
      tokens.push({ kind: 'punct', text: ch, start });
      i++;
      continue;
    }
    const hint = ch === '=' ? ' (bruk «==» for likhet)' : ch === '&' ? ' (bruk «&&»)' : ch === '|' ? ' (bruk «||»)' : '';
    throw new ExpressionSyntaxError(`Uventet tegn «${ch}» ved posisjon ${i + 1}${hint}.`, i);
  }
  tokens.push({ kind: 'eof', text: '', start: source.length });
  return tokens;
}

function readString(source: string, start: number): { value: string; end: number } {
  const quote = source[start]!;
  let value = '';
  let i = start + 1;
  while (i < source.length) {
    const ch = source[i]!;
    if (ch === quote) return { value, end: i + 1 };
    if (ch === '\\') {
      const next = source[i + 1];
      if (next === undefined) break;
      if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(source.slice(i + 2, i + 6))) {
        value += String.fromCharCode(parseInt(source.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      value += ESCAPES[next] ?? next;
      i += 2;
      continue;
    }
    value += ch;
    i++;
  }
  throw new ExpressionSyntaxError(`Uavsluttet streng som starter ved posisjon ${start + 1}.`, start);
}
