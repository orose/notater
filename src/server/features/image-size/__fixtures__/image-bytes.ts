/**
 * Små, syntetiske bildeheadere for tester (PO-71). Bare headerne er gyldige; bildedata er fyll. Ingen
 * binærfiler i repoet, og hver byte er forklart her.
 */

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
const u16be = (n: number): number[] => [(n >>> 8) & 0xff, n & 0xff];
const u16le = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff];
const u24le = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff];
const u32be = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u32le = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

/** PNG: signatur + IHDR (bredde, høyde, bitdybde 8, RGB) + falsk CRC + IEND. */
export function png(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...u32be(13), ...ascii('IHDR'), ...u32be(width), ...u32be(height), 8, 2, 0, 0, 0, 0, 0, 0, 0,
    ...u32be(0), ...ascii('IEND'), 0xae, 0x42, 0x60, 0x82,
  ]);
}

/** GIF: signatur + logisk skjermbeskrivelse + trailer. */
export function gif(width: number, height: number, version: '87a' | '89a' = '89a'): Uint8Array {
  return Uint8Array.from([...ascii(`GIF${version}`), ...u16le(width), ...u16le(height), 0, 0, 0, 0x3b]);
}

function riff(chunk: string, payload: number[]): Uint8Array {
  const body = [...ascii('WEBP'), ...ascii(chunk), ...u32le(payload.length), ...payload];
  return Uint8Array.from([...ascii('RIFF'), ...u32le(body.length), ...body]);
}

/** WebP VP8 (tapsbasert): rammetag + startkode + 14-bits bredde/høyde. */
export function webpVp8(width: number, height: number): Uint8Array {
  return riff('VP8 ', [0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, ...u16le(width), ...u16le(height), 0, 0, 0, 0]);
}

/** WebP VP8L (tapsfri): signatur 0x2F + (bredde−1) | (høyde−1) << 14 i 32 bit. */
export function webpVp8l(width: number, height: number): Uint8Array {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  return riff('VP8L', [0x2f, ...u32le(bits >>> 0), 0, 0, 0]);
}

/** WebP VP8X (utvidet): flagg + 3 reservert + 24-bits (bredde−1) og (høyde−1). */
export function webpVp8x(width: number, height: number): Uint8Array {
  return riff('VP8X', [0x10, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)]);
}

export interface JpegOptions {
  /** SOF-markør, standard 0xC0 (baseline). */
  readonly sof?: number;
  /** EXIF-orientering i et APP1-segment. */
  readonly orientation?: number;
  readonly bigEndian?: boolean;
  /** Ødelegger EXIF-blokken på en bestemt måte (orienteringen skal da ignoreres). */
  readonly corruptExif?: 'ifd-out-of-range' | 'huge-count' | 'wrong-type' | 'bad-byte-order' | 'bad-magic';
  /** Antall fyllbyte (0xFF) foran SOF-markøren. */
  readonly fillBytes?: number;
  /** Størrelse på ekstra APP2-segmenter (ICC-lignende fyll) før SOF, fordelt på segmenter à maks 65533 byte. */
  readonly paddingBytes?: number;
}

function segment(marker: number, payload: number[]): number[] {
  return [0xff, marker, ...u16be(payload.length + 2), ...payload];
}

function exif(orientation: number, bigEndian: boolean, corrupt: JpegOptions['corruptExif']): number[] {
  const u16 = bigEndian ? u16be : u16le;
  const u32 = bigEndian ? u32be : u32le;
  const order = corrupt === 'bad-byte-order' ? ascii('XX') : ascii(bigEndian ? 'MM' : 'II');
  const magic = corrupt === 'bad-magic' ? 43 : 42;
  const ifdOffset = corrupt === 'ifd-out-of-range' ? 0xfffffff0 : 8;
  const count = corrupt === 'huge-count' ? 0xffff : 2;
  const type = corrupt === 'wrong-type' ? 4 : 3;
  const entry = (tag: number, value: number): number[] => [...u16(tag), ...u16(type), ...u32(1), ...u16(value), 0, 0];
  const tiff = [
    ...order, ...u16(magic), ...u32(ifdOffset),
    ...u16(count), ...entry(0x010f, 0), ...entry(0x0112, orientation), ...u32(0),
  ];
  return [...ascii('Exif'), 0, 0, ...tiff];
}

/** JPEG: SOI, APP0 (JFIF), evt. APP1 (Exif) og fyll-APP2, DQT, SOF, DHT, SOS, litt data, EOI. */
export function jpeg(width: number, height: number, options: JpegOptions = {}): Uint8Array {
  const parts: number[] = [0xff, 0xd8];
  parts.push(...segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
  if (options.orientation !== undefined) {
    parts.push(...segment(0xe1, exif(options.orientation, options.bigEndian ?? false, options.corruptExif)));
  }
  let padding = options.paddingBytes ?? 0;
  while (padding > 0) {
    const n = Math.min(padding, 65533);
    parts.push(...segment(0xe2, new Array<number>(n).fill(0x41)));
    padding -= n;
  }
  parts.push(...segment(0xdb, [0, ...new Array<number>(64).fill(1)]));
  for (let i = 0; i < (options.fillBytes ?? 0); i++) parts.push(0xff);
  parts.push(...segment(options.sof ?? 0xc0, [8, ...u16be(height), ...u16be(width), 1, 1, 0x11, 0]));
  parts.push(...segment(0xc4, [0, ...new Array<number>(16).fill(0), 0]));
  parts.push(...segment(0xda, [1, 1, 0, 0, 0x3f, 0]));
  parts.push(0x12, 0x34, 0x56, 0xff, 0xd9);
  return Uint8Array.from(parts);
}
