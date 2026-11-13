// En liten FIGlet-leser (ADR-011 §5, designsystem-terminal §3): header, hardblank, endemerker, de påkrevde tegnene
// (ASCII 32–126 og de sju tyske) og kodemerkede tegn (ÆØÅ æøå –). Bare «full width»: fontene har luften innebygd,
// og det smushes ikke. Ingen `figlet`-pakke.

export interface FlfFont {
  readonly height: number;
  /** Tegn → rader (hardblank er mellomrom). Tegn med bredde 0 i fila mangler og er ikke med. */
  readonly glyphs: ReadonlyMap<string, readonly string[]>;
}

const REQUIRED = [...Array.from({ length: 95 }, (_, i) => 32 + i), 196, 214, 220, 228, 246, 252, 223];

export function parseFlf(source: string): FlfFont {
  const lines = source.split(/\r?\n/);
  const header = (lines[0] ?? '').split(' ');
  const signature = header[0] ?? '';
  if (!signature.startsWith('flf2a')) throw new Error('Ikke en FIGlet-font (mangler «flf2a»).');
  const hardblank = signature.slice(5, 6);
  const height = Number(header[1]);
  const comments = Number(header[5] ?? 0);
  let i = 1 + comments;
  const readGlyph = (): string[] => {
    const rows: string[] = [];
    for (let r = 0; r < height; r++) {
      const line = lines[i++] ?? '';
      const end = line.at(-1) ?? '';
      let body = line;
      while (body.endsWith(end) && body.length > 0) body = body.slice(0, -1);
      rows.push(body.split(hardblank).join(' '));
    }
    return rows;
  };
  const glyphs = new Map<string, string[]>();
  for (const code of REQUIRED) glyphs.set(String.fromCodePoint(code), readGlyph());
  while (i < lines.length && (lines[i] ?? '').trim() !== '') {
    const code = Number((lines[i] ?? '').trim().split(/\s+/)[0]);
    i += 1;
    glyphs.set(String.fromCodePoint(code), readGlyph());
  }
  for (const [ch, rows] of glyphs) if (Math.max(...rows.map((r) => r.length)) === 0) glyphs.delete(ch);
  return { height, glyphs };
}

/** Tekst slik fontene tegner den: versaler, ÆØÅ beholdes, andre aksenter fjernes (NFD). */
export function figletText(text: string): string {
  return [...text.normalize('NFC')]
    .map((c) => ('ÆØÅæøå'.includes(c) ? c : (c.normalize('NFD')[0] ?? c)))
    .join('')
    .toUpperCase();
}

/** Én linje figlet, eller `null` når et tegn mangler i fonten. */
export function renderFiglet(font: FlfFont, text: string): string[] | null {
  const rows = Array.from({ length: font.height }, () => '');
  for (const ch of text) {
    const glyph = font.glyphs.get(ch);
    if (!glyph) return null;
    const width = Math.max(...glyph.map((r) => [...r].length));
    glyph.forEach((r, k) => (rows[k] += r.padEnd(width + (r.length - [...r].length))));
  }
  return rows.map((r) => r.replace(/\s+$/u, ''));
}

export function figletWidth(rows: readonly string[]): number {
  return Math.max(0, ...rows.map((r) => [...r].length));
}
