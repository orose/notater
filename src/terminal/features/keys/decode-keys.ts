// stdin-bytes → tastetrykk (ADR-011 §6). Ren tilstandsmaskin med injisert klokke; ingen Node-avhengighet.
//
// Resultatet har samme form som `KeyInput` i tastaturmotoren (ADR-007 §3), så `chordCandidates` og
// `createKeyEngine` brukes uendret når de er flyttet til `src/core/keyboard` (ADR-011 §1, trinn K4).
//
// Støtter:
//   - vanlige tegn (UTF-8, ett tastetrykk per grafem – terminalen har allerede brukt tastaturoppsettet, så `:`,
//     `?` og `ø` på norsk Mac kommer som tegn); store bokstaver får `shiftKey`.
//   - C0-kontroll: Enter, Tab, Backspace, Ctrl+bokstav (Ctrl c = 0x03 – raw mode slår av SIGINT).
//   - CSI/SS3: piler, Home/End, PageUp/PageDown, Delete, med modifikatorparameter (`CSI 1;5C`).
//   - CSI u (kitty-tastaturprotokollen, flagg 1 «disambiguate», som Ghostty støtter): `CSI kode;mod u`.
//   - Alt som `ESC x`; ensom ESC etter `escapeTimeoutMs` (bare uten CSI u – der er Esc entydig).
//   - Bracketed paste (`CSI 200~ … CSI 201~`) som egen hendelse.
//   - Svar fra terminalen (`CSI ? … u`, DA1 `CSI ? … c`, OSC 11) som `reply`, aldri som taster.

export interface DecodedKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

export type TerminalInput =
  | { readonly kind: 'key'; readonly key: DecodedKey }
  | { readonly kind: 'paste'; readonly text: string }
  | { readonly kind: 'reply'; readonly sequence: string };

export interface DecoderTimers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface KeyDecoderOptions {
  readonly onInput: (input: TerminalInput) => void;
  readonly timers: DecoderTimers;
  /** Ventetid før en ensom ESC tolkes som Escape (som vims `ttimeoutlen`). */
  readonly escapeTimeoutMs?: number;
}

export interface KeyDecoder {
  feed(chunk: string): void;
  /** Tøm en ventende ESC (f.eks. ved avslutning). */
  flush(): void;
}

export const ESCAPE_TIMEOUT_MS = 30;

const CSI_TILDE: Readonly<Record<string, string>> = { '1': 'Home', '2': 'Insert', '3': 'Delete', '4': 'End', '5': 'PageUp', '6': 'PageDown', '7': 'Home', '8': 'End' };
const CSI_FINAL: Readonly<Record<string, string>> = { A: 'ArrowUp', B: 'ArrowDown', C: 'ArrowRight', D: 'ArrowLeft', H: 'Home', F: 'End', Z: 'Tab' };
/** Funksjonelle koder i CSI u (kitty) som har egne navn. */
const CSI_U_NAMES: Readonly<Record<number, string>> = { 9: 'Tab', 13: 'Enter', 27: 'Escape', 32: 'Space', 127: 'Backspace' };

const LETTER = /^\p{L}$/u;
const segmenter = new Intl.Segmenter('nb', { granularity: 'grapheme' });

function key(name: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}): DecodedKey {
  const shift = mods.shift ?? (LETTER.test(name) && name !== name.toLowerCase());
  return { key: name, ctrlKey: mods.ctrl ?? false, metaKey: false, altKey: mods.alt ?? false, shiftKey: shift };
}

/** xterm/kitty-modifikator: verdi = 1 + bitmaske (shift 1, alt 2, ctrl 4, super 8). */
function modifiers(param: string | undefined): { ctrl: boolean; alt: boolean; shift: boolean } {
  const bits = Math.max(0, (Number(param ?? '1') || 1) - 1);
  return { shift: (bits & 1) !== 0, alt: (bits & 2) !== 0, ctrl: (bits & 4) !== 0 };
}

function controlKey(code: number): DecodedKey | null {
  if (code === 0x0d || code === 0x0a) return key('Enter');
  if (code === 0x09) return key('Tab');
  if (code === 0x7f || code === 0x08) return key('Backspace');
  if (code === 0x00) return key('Space', { ctrl: true });
  if (code >= 0x01 && code <= 0x1a) return key(String.fromCharCode(code + 0x60), { ctrl: true, shift: false });
  return null;
}

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

export function createKeyDecoder(options: KeyDecoderOptions): KeyDecoder {
  const timeout = options.escapeTimeoutMs ?? ESCAPE_TIMEOUT_MS;
  let buffer = '';
  let pasting: string | null = null;
  let escTimer: unknown = null;

  const emitKey = (k: DecodedKey) => options.onInput({ kind: 'key', key: k });

  /** Prøver å tolke én sekvens i starten av `buffer`. Returnerer antall tegn brukt, 0 = trenger mer. */
  const parseOne = (s: string): number => {
    const first = s.charCodeAt(0);
    if (first !== 0x1b) {
      const control = controlKey(first);
      if (control) {
        emitKey(control);
        return 1;
      }
      const g = segmenter.segment(s)[Symbol.iterator]().next().value?.segment ?? s[0] ?? '';
      emitKey(g === ' ' ? key('Space') : key(g));
      return g.length;
    }
    if (s.length === 1) return 0;
    const second = s[1];
    if (second === '[') {
      // CSI: parametre (0x30–0x3f), mellomtegn (0x20–0x2f), slutt (0x40–0x7e).
      // eslint-disable-next-line no-control-regex -- terminalens kontrollsekvenser
      const m = /^\x1b\[([0-?]*)([ -/]*)([@-~])/.exec(s);
      // eslint-disable-next-line no-control-regex -- terminalens kontrollsekvenser
      if (!m) return /^\x1b\[[0-?]*[ -/]*$/.test(s) ? 0 : 2;
      const [whole, params = '', , final = ''] = m;
      if (params.startsWith('?') || params.startsWith('>')) {
        options.onInput({ kind: 'reply', sequence: whole });
        return whole.length;
      }
      const parts = params.split(';');
      if (final === 'u') {
        const code = Number((parts[0] ?? '').split(':')[0]);
        const mods = modifiers(parts[1]);
        const name = CSI_U_NAMES[code] ?? (Number.isInteger(code) && code > 0 ? String.fromCodePoint(code) : '');
        if (name === '') return whole.length;
        // Kitty sender liten bokstav + shift-bit; motoren forventer `G` med shiftKey (ADR-007 §3).
        emitKey(key(mods.shift && !mods.ctrl && LETTER.test(name) ? name.toUpperCase() : name, mods));
        return whole.length;
      }
      if (final === '~') {
        const name = CSI_TILDE[parts[0] ?? ''];
        if (name) emitKey(key(name, modifiers(parts[1])));
        return whole.length;
      }
      const name = CSI_FINAL[final];
      if (name) emitKey(key(name, final === 'Z' ? { shift: true } : modifiers(parts[1])));
      return whole.length;
    }
    if (second === 'O') {
      if (s.length < 3) return 0;
      const name = CSI_FINAL[s[2] ?? ''];
      if (name) emitKey(key(name));
      return 3;
    }
    if (second === ']') {
      // OSC-svar (f.eks. bakgrunnsfarge, OSC 11), avsluttet med BEL eller ST.
      // eslint-disable-next-line no-control-regex -- terminalens kontrollsekvenser
      const end = s.search(/\x07|\x1b\\/);
      if (end === -1) return 0;
      const length = end + (s[end] === '\x07' ? 1 : 2);
      options.onInput({ kind: 'reply', sequence: s.slice(0, length) });
      return length;
    }
    if (second === '\x1b') {
      emitKey(key('Escape'));
      return 1;
    }
    // Alt+tegn.
    const inner = parseInner(s.slice(1));
    if (inner) {
      emitKey({ ...inner.key, altKey: true });
      return 1 + inner.length;
    }
    return 0;
  };

  const parseInner = (s: string): { key: DecodedKey; length: number } | null => {
    if (s === '') return null;
    const control = controlKey(s.charCodeAt(0));
    if (control) return { key: control, length: 1 };
    const g = segmenter.segment(s)[Symbol.iterator]().next().value?.segment ?? '';
    return { key: g === ' ' ? key('Space') : key(g), length: g.length };
  };

  const drain = () => {
    while (buffer.length > 0) {
      if (pasting !== null) {
        const end = buffer.indexOf(PASTE_END);
        if (end === -1) {
          pasting += buffer;
          buffer = '';
          return;
        }
        options.onInput({ kind: 'paste', text: pasting + buffer.slice(0, end) });
        pasting = null;
        buffer = buffer.slice(end + PASTE_END.length);
        continue;
      }
      if (buffer.startsWith(PASTE_START)) {
        pasting = '';
        buffer = buffer.slice(PASTE_START.length);
        continue;
      }
      const used = parseOne(buffer);
      if (used === 0) {
        // Ufullstendig sekvens: vent på flere bytes, men tolk en ensom ESC som Escape etter tidsavbruddet.
        escTimer = options.timers.setTimeout(flush, timeout);
        return;
      }
      buffer = buffer.slice(used);
    }
  };

  const flush = () => {
    if (escTimer !== null) options.timers.clearTimeout(escTimer);
    escTimer = null;
    if (buffer.startsWith('\x1b')) {
      emitKey(key('Escape'));
      buffer = buffer.slice(1);
    }
    drain();
  };

  return {
    feed(chunk) {
      if (escTimer !== null) options.timers.clearTimeout(escTimer);
      escTimer = null;
      buffer += chunk;
      drain();
    },
    flush,
  };
}
