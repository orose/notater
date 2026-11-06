/**
 * Dimensjoner for lokale bilder lest fra filheaderen (PO-71), uten avhengigheter. Støtter PNG (IHDR),
 * JPEG (SOF-markør, med EXIF-orientering), GIF, WebP (VP8, VP8L, VP8X) og SVG (width/height/viewBox).
 *
 * Alt er defensivt: ukjent, avkortet eller ødelagt innhold gir `null`, aldri et unntak. Parserne leser
 * bare små biter via `ByteReader` og har faste øvre grenser for hvor mye og hvor lenge de leser.
 */
import { bufferReader, withFileReader } from './byte-reader';
import type { ByteReader } from './byte-reader';

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/** Større verdier regnes som ødelagt header (og ville uansett ikke vært nyttige som `width`/`height`). */
export const MAX_IMAGE_DIMENSION = 100_000;

/** Endelser vi forsøker å lese dimensjoner for. Andre bildetyper (avif, bmp, ico) får ingen attributter. */
const SIZED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

export function canReadImageSize(ext: string): boolean {
  return SIZED_EXTENSIONS.has(ext.toLowerCase());
}

/** Leser dimensjonene fra en fil på disk. `null` ved ukjent format, ødelagt header eller I/O-feil. */
export async function readImageSizeFromFile(absolutePath: string, ext: string): Promise<ImageSize | null> {
  if (!canReadImageSize(ext)) return null;
  try {
    return await withFileReader(absolutePath, (reader) => readImageSize(reader, ext));
  } catch {
    return null;
  }
}

/** Som `readImageSizeFromFile`, men fra bytes i minnet. */
export async function imageSizeFromBytes(bytes: Uint8Array, ext: string): Promise<ImageSize | null> {
  try {
    return await readImageSize(bufferReader(bytes), ext);
  } catch {
    return null;
  }
}

/** Formatet avgjøres av magiske byte; SVG (tekst) bare når endelsen er `.svg`. */
async function readImageSize(reader: ByteReader, ext: string): Promise<ImageSize | null> {
  const head = await reader.read(0, 32);
  if (startsWith(head, PNG_SIGNATURE)) return pngSize(head);
  if (startsWith(head, GIF87) || startsWith(head, GIF89)) return gifSize(head);
  if (startsWith(head, RIFF) && startsWith(head.subarray(8), WEBP)) return webpSize(head);
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return jpegSize(reader);
  if (ext.toLowerCase() === 'svg') return svgSize(reader);
  return null;
}

// ---------------------------------------------------------------- raster

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = ascii('IHDR');
const GIF87 = ascii('GIF87a');
const GIF89 = ascii('GIF89a');
const RIFF = ascii('RIFF');
const WEBP = ascii('WEBP');

/** PNG: signatur, så første chunk må være IHDR med bredde/høyde (u32 BE) på 16/20. */
function pngSize(b: Uint8Array): ImageSize | null {
  if (b.length < 24 || !startsWith(b.subarray(12), IHDR)) return null;
  return toSize(u32be(b, 16), u32be(b, 20));
}

/** GIF: logisk skjermstørrelse (u16 LE) på 6/8. */
function gifSize(b: Uint8Array): ImageSize | null {
  if (b.length < 10) return null;
  return toSize(u16le(b, 6), u16le(b, 8));
}

/** WebP: første chunk etter `RIFF....WEBP` avgjør varianten. */
function webpSize(b: Uint8Array): ImageSize | null {
  if (b.length < 30) {
    // VP8L trenger bare 25 byte; de andre 30.
    if (!(b.length >= 25 && startsWith(b.subarray(12), ascii('VP8L')))) return null;
  }
  const chunk = String.fromCharCode(...b.subarray(12, 16));
  if (chunk === 'VP8 ') {
    // Tapsbasert: 3 byte rammetag, startkode 9D 01 2A, deretter 14-bits bredde/høyde (+ 2 bit skala).
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return toSize(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  if (chunk === 'VP8L') {
    // Tapsfri: signatur 0x2F, så 14 bit (bredde − 1) og 14 bit (høyde − 1), little endian.
    if (b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return toSize((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === 'VP8X') {
    // Utvidet: lerretsstørrelse − 1 som 24-bits LE på 24/27.
    return toSize(u24le(b, 24) + 1, u24le(b, 27) + 1);
  }
  return null;
}

/** Øvre grense for antall markører vi går gjennom før vi gir opp (vern mot løkker i ondsinnede filer). */
const MAX_JPEG_MARKERS = 1024;

/**
 * JPEG: gå markør for markør (hopp over segmentene med lengdefeltet) til første SOFn. Segmenter vi ikke
 * trenger leses ikke, så store EXIF-/ICC-blokker koster bare én posisjonslesing.
 */
async function jpegSize(reader: ByteReader): Promise<ImageSize | null> {
  let offset = 2;
  let orientation = 1;
  for (let i = 0; i < MAX_JPEG_MARKERS; i++) {
    const head = await reader.read(offset, 4);
    if (head.length < 2 || head[0] !== 0xff) return null;
    const marker = head[1]!;
    if (marker === 0xff) {
      offset += 1; // fyllbyte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // markører uten lengde
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI/SOS før SOF
    if (head.length < 4) return null;
    const length = u16be(head, 2);
    if (length < 2) return null;
    if (isStartOfFrame(marker)) {
      const sof = await reader.read(offset + 4, 5);
      if (sof.length < 5 || length < 7) return null;
      const size = toSize(u16be(sof, 3), u16be(sof, 1));
      // EXIF-orientering 5–8 roterer 90°: nettleseren viser bildet med byttet bredde/høyde.
      return size && orientation >= 5 ? { width: size.height, height: size.width } : size;
    }
    if (marker === 0xe1 && orientation === 1) orientation = await exifOrientation(reader, offset + 4, length - 2);
    offset += 2 + length;
  }
  return null;
}

/** SOF0–SOF15 unntatt DHT (C4), JPG (C8) og DAC (CC). */
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

const EXIF = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
const MAX_IFD_ENTRIES = 256;

/** Orientering (tagg 0x0112) i IFD0 i et APP1/Exif-segment. Alle offset sjekkes mot segmentet; 1 ved tvil. */
async function exifOrientation(reader: ByteReader, start: number, length: number): Promise<number> {
  const header = await reader.read(start, 14);
  if (length < 14 || header.length < 14 || !startsWith(header, EXIF)) return 1;
  const tiff = header.subarray(6);
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return 1;
  const u16 = (b: Uint8Array, o: number): number => (little ? u16le(b, o) : u16be(b, o));
  const u32 = (b: Uint8Array, o: number): number => (little ? u32le(b, o) : u32be(b, o));
  if (u16(tiff, 2) !== 42) return 1;
  const tiffLength = length - 6;
  const ifd = u32(tiff, 4);
  if (ifd < 8 || ifd + 2 > tiffLength) return 1;
  const countBytes = await reader.read(start + 6 + ifd, 2);
  if (countBytes.length < 2) return 1;
  const count = Math.min(u16(countBytes, 0), MAX_IFD_ENTRIES, Math.floor((tiffLength - ifd - 2) / 12));
  if (count <= 0) return 1;
  const entries = await reader.read(start + 6 + ifd + 2, count * 12);
  for (let e = 0; e + 12 <= entries.length; e += 12) {
    if (u16(entries, e) !== 0x0112) continue;
    if (u16(entries, e + 2) !== 3) return 1; // må være SHORT
    const value = u16(entries, e + 8);
    return value >= 1 && value <= 8 ? value : 1;
  }
  return 1;
}

// ---------------------------------------------------------------- SVG

/** Rot-taggen må ligge innenfor de første 64 KiB (etter XML-deklarasjon, kommentarer og DOCTYPE). */
const SVG_READ_BYTES = 64 * 1024;

async function svgSize(reader: ByteReader): Promise<ImageSize | null> {
  const bytes = await reader.read(0, SVG_READ_BYTES);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^﻿/, '');
  const attrs = rootSvgAttributes(text);
  if (!attrs) return null;
  const width = attrs.width === undefined ? null : parseLength(attrs.width);
  const height = attrs.height === undefined ? null : parseLength(attrs.height);
  const viewBox = attrs.viewBox === undefined ? null : parseViewBox(attrs.viewBox);
  if (width !== null && height !== null) return toSize(width, height);
  if (viewBox === null) return null;
  if (width !== null) return toSize(width, (width * viewBox.height) / viewBox.width);
  if (height !== null) return toSize((height * viewBox.width) / viewBox.height, height);
  return toSize(viewBox.width, viewBox.height);
}

/**
 * Attributtene på rotelementet hvis det er `<svg>` (evt. med navneromsprefiks). Hopper over `<?xml …?>`,
 * kommentarer og `<!DOCTYPE … [ … ]>`. Tåler `>` i siterte verdier. `null` hvis roten ikke er svg eller
 * taggen er avkortet.
 */
export function rootSvgAttributes(text: string): Record<string, string> | null {
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt === -1) return null;
    if (text.startsWith('<?', lt)) {
      const end = text.indexOf('?>', lt + 2);
      if (end === -1) return null;
      i = end + 2;
    } else if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      if (end === -1) return null;
      i = end + 3;
    } else if (text.startsWith('<!', lt)) {
      const end = skipDeclaration(text, lt + 2);
      if (end === -1) return null;
      i = end;
    } else {
      const name = /^<(?:[A-Za-z_][\w.-]*:)?svg(?=[\s/>])/.exec(text.slice(lt, lt + 64));
      return name ? parseAttributes(text, lt + name[0].length) : null;
    }
  }
  return null;
}

/** Slutten (indeks etter `>`) av en `<!…>`-deklarasjon med evt. `[ … ]` og siterte strenger. */
function skipDeclaration(text: string, from: number): number {
  let depth = 0;
  for (let j = from; j < text.length; j++) {
    const c = text[j];
    if (c === '"' || c === "'") {
      const end = text.indexOf(c, j + 1);
      if (end === -1) return -1;
      j = end;
    } else if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if (c === '>' && depth === 0) return j + 1;
  }
  return -1;
}

function parseAttributes(text: string, from: number): Record<string, string> | null {
  const attrs: Record<string, string> = Object.create(null) as Record<string, string>;
  const nameRe = /[^\s=/>]+/y;
  const unquotedRe = /[^\s>]*/y;
  let j = from;
  const skipSpace = (): void => {
    while (j < text.length && /\s/.test(text[j]!)) j++;
  };
  for (;;) {
    skipSpace();
    if (j >= text.length) return null;
    if (text[j] === '>' || text.startsWith('/>', j)) return attrs;
    if (text[j] === '/') {
      j++;
      continue;
    }
    nameRe.lastIndex = j;
    const name = nameRe.exec(text);
    if (!name) return null;
    j = nameRe.lastIndex;
    skipSpace();
    if (text[j] !== '=') {
      attrs[name[0]] = '';
      continue;
    }
    j++;
    skipSpace();
    const quote = text[j];
    let value: string;
    if (quote === '"' || quote === "'") {
      const end = text.indexOf(quote, j + 1);
      if (end === -1) return null;
      value = text.slice(j + 1, end);
      j = end + 1;
    } else {
      unquotedRe.lastIndex = j;
      value = unquotedRe.exec(text)?.[0] ?? '';
      j = unquotedRe.lastIndex;
    }
    if (!(name[0] in attrs)) attrs[name[0]] = value;
  }
}

/** CSS px per enhet. Relative enheter (%, em, ex …) gir ingen størrelse. */
const UNITS: Readonly<Record<string, number>> = { '': 1, px: 1, pt: 4 / 3, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
const LENGTH = /^\s*\+?((?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i;

function parseLength(value: string): number | null {
  const m = LENGTH.exec(value);
  if (!m) return null;
  const factor = UNITS[m[2]!.toLowerCase()];
  if (factor === undefined) return null;
  const n = Number(m[1]) * factor;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseViewBox(value: string): ImageSize | null {
  const parts = value.trim().split(/[\s,]+/);
  if (parts.length !== 4) return null;
  const numbers = parts.map(Number);
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  const [, , width, height] = numbers as [number, number, number, number];
  return width > 0 && height > 0 ? { width, height } : null;
}

// ---------------------------------------------------------------- hjelpere

function toSize(width: number, height: number): ImageSize | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  return w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION ? null : { width: w, height: h };
}

function ascii(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}

function startsWith(b: Uint8Array, prefix: readonly number[]): boolean {
  return b.length >= prefix.length && prefix.every((v, i) => b[i] === v);
}

const u16be = (b: Uint8Array, o: number): number => (b[o]! << 8) | b[o + 1]!;
const u16le = (b: Uint8Array, o: number): number => b[o]! | (b[o + 1]! << 8);
const u24le = (b: Uint8Array, o: number): number => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
const u32be = (b: Uint8Array, o: number): number => ((b[o]! << 24) >>> 0) + ((b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!);
const u32le = (b: Uint8Array, o: number): number => ((b[o + 3]! << 24) >>> 0) + ((b[o + 2]! << 16) | (b[o + 1]! << 8) | b[o]!);
