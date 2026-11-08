/**
 * PO-71: dimensjoner fra filheaderen. Fixtures bygges som små byte-sekvenser her i testen (ingen binærfiler),
 * pluss ondsinnede og avkortede headere: alt som ikke er et gyldig bilde skal gi `null`, aldri et unntak.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canReadImageSize, imageSizeFromBytes, MAX_IMAGE_DIMENSION, readImageSizeFromFile, rootSvgAttributes } from './read-image-size';
import { gif, jpeg, png, webpVp8, webpVp8l, webpVp8x } from './__fixtures__/image-bytes';

const svg = (source: string): Uint8Array => new TextEncoder().encode(source);
const size = (width: number, height: number) => ({ width, height });

describe('raster-formater', () => {
  it('PNG: IHDR', async () => {
    expect(await imageSizeFromBytes(png(320, 180), 'png')).toEqual(size(320, 180));
    expect(await imageSizeFromBytes(png(1, 65535), 'png')).toEqual(size(1, 65535));
  });

  it('GIF87a og GIF89a', async () => {
    expect(await imageSizeFromBytes(gif(16, 9), 'gif')).toEqual(size(16, 9));
    expect(await imageSizeFromBytes(gif(500, 2, '87a'), 'gif')).toEqual(size(500, 2));
  });

  it('JPEG: baseline (SOF0) og progressiv (SOF2), etter APP0/APP1/DQT/DHT', async () => {
    expect(await imageSizeFromBytes(jpeg(640, 480), 'jpg')).toEqual(size(640, 480));
    expect(await imageSizeFromBytes(jpeg(800, 600, { sof: 0xc2 }), 'jpeg')).toEqual(size(800, 600));
  });

  it('JPEG: fyllbyte (0xFF) mellom markører', async () => {
    expect(await imageSizeFromBytes(jpeg(10, 20, { fillBytes: 7 }), 'jpg')).toEqual(size(10, 20));
  });

  it('JPEG: EXIF-orientering 5–8 bytter bredde og høyde (begge byte-rekkefølger)', async () => {
    expect(await imageSizeFromBytes(jpeg(400, 300, { orientation: 6 }), 'jpg')).toEqual(size(300, 400));
    expect(await imageSizeFromBytes(jpeg(400, 300, { orientation: 8, bigEndian: true }), 'jpg')).toEqual(size(300, 400));
    expect(await imageSizeFromBytes(jpeg(400, 300, { orientation: 3 }), 'jpg')).toEqual(size(400, 300));
    expect(await imageSizeFromBytes(jpeg(400, 300, { orientation: 1 }), 'jpg')).toEqual(size(400, 300));
  });

  it('WebP: VP8 (tapsbasert), VP8L (tapsfri) og VP8X (utvidet)', async () => {
    expect(await imageSizeFromBytes(webpVp8(1024, 768), 'webp')).toEqual(size(1024, 768));
    expect(await imageSizeFromBytes(webpVp8l(16383, 1), 'webp')).toEqual(size(16383, 1));
    expect(await imageSizeFromBytes(webpVp8l(3, 5), 'webp')).toEqual(size(3, 5));
    expect(await imageSizeFromBytes(webpVp8x(5000, 70000), 'webp')).toEqual(size(5000, 70000));
  });

  it('formatet avgjøres av innholdet, ikke endelsen', async () => {
    expect(await imageSizeFromBytes(png(7, 8), 'jpg')).toEqual(size(7, 8));
    expect(await imageSizeFromBytes(jpeg(7, 8), 'png')).toEqual(size(7, 8));
  });
});

describe('SVG', () => {
  const cases: [string, string, { width: number; height: number } | null][] = [
    ['width/height i px', '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"/>', size(120, 80)],
    ['enhetsløse desimaltall avrundes', '<svg width="10.6" height=\'20.4\'></svg>', size(11, 20)],
    ['absolutte enheter regnes om til CSS-px', '<svg width="1in" height="25.4mm" viewBox="0 0 1 1"/>', size(96, 96)],
    ['pt, pc og cm', '<svg width="72pt" height="2.54cm"/>', size(96, 96)],
    ['bare viewBox', '<svg viewBox="0 0 240 80"/>', size(240, 80)],
    ['viewBox med komma og negativ origo', '<svg viewBox="-10,-10, 300 , 150"/>', size(300, 150)],
    ['bredde + viewBox gir høyde', '<svg width="300" viewBox="0 0 200 100"/>', size(300, 150)],
    ['høyde + viewBox gir bredde', '<svg height="50" viewBox="0 0 200 100"/>', size(100, 50)],
    ['prosent faller tilbake til viewBox', '<svg width="100%" height="100%" viewBox="0 0 40 30"/>', size(40, 30)],
    ['em uten viewBox gir ingenting', '<svg width="10em" height="5em"/>', null],
    ['bare bredde uten viewBox gir ingenting', '<svg width="100"/>', null],
    ['XML-deklarasjon, kommentar og DOCTYPE med intern subset først', '﻿<?xml version="1.0"?>\n<!-- <svg width="1" height="1"> -->\n<!DOCTYPE svg [ <!ENTITY x "<svg width=\'2\'>"> ]>\n<svg width="64" height="32"/>', size(64, 32)],
    ['`>` i en sitert attributtverdi', '<svg data-x="a>b" width="12" height="34"></svg>', size(12, 34)],
    ['navneromsprefiks', '<svg:svg xmlns:svg="http://www.w3.org/2000/svg" width="5" height="6"/>', size(5, 6)],
    ['attributter over flere linjer, første forekomst vinner', '<svg\n  width = "7"\n  height="8"\n  width="999"\n>', size(7, 8)],
    ['roten er ikke svg', '<html><svg width="1" height="1"/></html>', null],
    ['svgfoo er ikke svg', '<svgfoo width="1" height="1"/>', null],
    ['avkortet tag', '<svg width="10" height="1', null],
    ['uavsluttet kommentar', '<!-- <svg width="1" height="1"/>', null],
    ['null, negativ og NaN', '<svg width="0" height="-5" viewBox="0 0 0 10"/>', null],
    ['ugyldig viewBox', '<svg viewBox="0 0 abc 10"/>', null],
    ['for store verdier', `<svg width="${MAX_IMAGE_DIMENSION + 1}" height="1"/>`, null],
    ['eksponent som gir uendelig', '<svg width="1e999" height="1"/>', null],
    ['tom fil', '', null],
    ['ikke XML', 'GIF? nei', null],
  ];
  for (const [name, source, expected] of cases) {
    it(name, async () => {
      expect(await imageSizeFromBytes(svg(source), 'svg')).toEqual(expected);
    });
  }

  it('SVG-tekst tolkes bare for .svg-filer', async () => {
    expect(await imageSizeFromBytes(svg('<svg width="1" height="1"/>'), 'png')).toBeNull();
  });

  it('rotelementet etter 64 KiB med kommentarer gir ingenting (lesegrense)', async () => {
    const padding = `<!--${'x'.repeat(70 * 1024)}-->`;
    expect(await imageSizeFromBytes(svg(`${padding}<svg width="1" height="1"/>`), 'svg')).toBeNull();
  });

  it('rootSvgAttributes tåler patologisk input raskt', () => {
    const started = performance.now();
    expect(rootSvgAttributes(`<svg ${'a '.repeat(50_000)}`)).toBeNull();
    expect(rootSvgAttributes('<!DOCTYPE '.repeat(10_000))).toBeNull();
    expect(rootSvgAttributes(`<svg ${'x="'.repeat(10_000)}`)).not.toBeUndefined();
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('ondsinnede og avkortede headere', () => {
  const valid: [string, Uint8Array, string][] = [
    ['png', png(320, 180), 'png'],
    ['gif', gif(16, 9), 'gif'],
    ['jpeg', jpeg(640, 480, { orientation: 6 }), 'jpg'],
    ['webp-vp8', webpVp8(10, 10), 'webp'],
    ['webp-vp8l', webpVp8l(10, 10), 'webp'],
    ['webp-vp8x', webpVp8x(10, 10), 'webp'],
  ];

  for (const [name, bytes, ext] of valid) {
    it(`${name}: hver avkorting gir null eller riktig størrelse, aldri unntak`, async () => {
      const full = await imageSizeFromBytes(bytes, ext);
      expect(full).not.toBeNull();
      for (let length = 0; length < bytes.length; length++) {
        const result = await imageSizeFromBytes(bytes.subarray(0, length), ext);
        // JPEG kan ha nok før slutten (SOF kommer før bildedataene); da må svaret være det riktige.
        if (result !== null) expect(result).toEqual(full);
      }
    });
  }

  it('PNG: annen chunk enn IHDR først, null-dimensjoner og absurde verdier', async () => {
    const wrongChunk = png(10, 10);
    wrongChunk.set([0x49, 0x44, 0x41, 0x54], 12); // «IDAT»
    expect(await imageSizeFromBytes(wrongChunk, 'png')).toBeNull();
    expect(await imageSizeFromBytes(png(0, 10), 'png')).toBeNull();
    expect(await imageSizeFromBytes(png(0xffffffff, 0xffffffff), 'png')).toBeNull();
    expect(await imageSizeFromBytes(png(MAX_IMAGE_DIMENSION + 1, 1), 'png')).toBeNull();
  });

  it('GIF og WebP med null-dimensjoner / feil startkode / ukjent chunk', async () => {
    expect(await imageSizeFromBytes(gif(0, 0), 'gif')).toBeNull();
    const badStart = webpVp8(10, 10);
    badStart[23] = 0;
    expect(await imageSizeFromBytes(badStart, 'webp')).toBeNull();
    const badSignature = webpVp8l(10, 10);
    badSignature[20] = 0;
    expect(await imageSizeFromBytes(badSignature, 'webp')).toBeNull();
    const unknown = webpVp8(10, 10);
    unknown.set([0x41, 0x4c, 0x50, 0x48], 12); // «ALPH»
    expect(await imageSizeFromBytes(unknown, 'webp')).toBeNull();
  });

  it('JPEG: segmentlengde 0/1 (ville gitt evig løkke), SOS før SOF, EOI, og lengde forbi filslutt', async () => {
    const soi = [0xff, 0xd8];
    expect(await imageSizeFromBytes(Uint8Array.from([...soi, 0xff, 0xe0, 0x00, 0x00]), 'jpg')).toBeNull();
    expect(await imageSizeFromBytes(Uint8Array.from([...soi, 0xff, 0xe0, 0x00, 0x01]), 'jpg')).toBeNull();
    expect(await imageSizeFromBytes(Uint8Array.from([...soi, 0xff, 0xda, 0x00, 0x08, 1, 2, 3]), 'jpg')).toBeNull();
    expect(await imageSizeFromBytes(Uint8Array.from([...soi, 0xff, 0xd9]), 'jpg')).toBeNull();
    expect(await imageSizeFromBytes(Uint8Array.from([...soi, 0xff, 0xe0, 0xff, 0xff, 0, 0]), 'jpg')).toBeNull();
    expect(await imageSizeFromBytes(Uint8Array.from([...soi, 0x12, 0x34]), 'jpg')).toBeNull();
  });

  it('JPEG: uendelig mange fyllbyte / tomme markører stopper etter en fast grense', async () => {
    const bytes = new Uint8Array(200_000).fill(0xff);
    bytes.set([0xff, 0xd8, 0xff], 0);
    expect(await imageSizeFromBytes(bytes, 'jpg')).toBeNull();
    const restarts = new Uint8Array(200_000);
    restarts.set([0xff, 0xd8], 0);
    for (let i = 2; i + 1 < restarts.length; i += 2) restarts.set([0xff, 0xd0], i);
    expect(await imageSizeFromBytes(restarts, 'jpg')).toBeNull();
  });

  it('JPEG: SOF med null høyde (DNL) og for kort SOF-segment', async () => {
    expect(await imageSizeFromBytes(jpeg(100, 0), 'jpg')).toBeNull();
    const short = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x05, 8, 0, 10, 0, 10]);
    expect(await imageSizeFromBytes(short, 'jpg')).toBeNull();
  });

  it('JPEG: ødelagt EXIF (IFD-offset utenfor segmentet, feil type/byte-rekkefølge) ignoreres; enormt antall-felt begrenses', async () => {
    for (const exif of ['ifd-out-of-range', 'wrong-type', 'bad-byte-order', 'bad-magic'] as const) {
      expect(await imageSizeFromBytes(jpeg(400, 300, { orientation: 6, corruptExif: exif }), 'jpg'), exif).toEqual(size(400, 300));
    }
    // Antall-feltet begrenses til det som får plass i segmentet; oppføringene som finnes leses fortsatt.
    expect(await imageSizeFromBytes(jpeg(400, 300, { orientation: 6, corruptExif: 'huge-count' }), 'jpg')).toEqual(size(300, 400));
  });

  it('deterministisk fuzzing: tilfeldige byte og muterte gyldige filer kaster aldri', async () => {
    let seed = 0x12345678;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return seed / 0x100000000;
    };
    const exts = ['png', 'jpg', 'gif', 'webp', 'svg'];
    for (let i = 0; i < 2000; i++) {
      const base = valid[i % valid.length]![1];
      const bytes = random() < 0.5 ? Uint8Array.from(base) : new Uint8Array(Math.floor(random() * 64));
      for (let m = 0; m < 4; m++) bytes[Math.floor(random() * bytes.length)] = Math.floor(random() * 256);
      const result = await imageSizeFromBytes(bytes, exts[i % exts.length]!);
      if (result !== null) {
        expect(result.width).toBeGreaterThanOrEqual(1);
        expect(result.height).toBeGreaterThanOrEqual(1);
        expect(result.width).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
        expect(result.height).toBeLessThanOrEqual(MAX_IMAGE_DIMENSION);
      }
    }
  });
});

describe('fra disk', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'vr-image-size-'));
    await mkdir(join(dir, 'mappe.png'));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('JPEG med stort APP-segment (300 KiB ICC/EXIF) før SOF: hopper over med posisjonslesing', async () => {
    const path = join(dir, 'stor.jpg');
    await writeFile(path, jpeg(4000, 3000, { orientation: 6, paddingBytes: 300 * 1024 }));
    expect(await readImageSizeFromFile(path, 'jpg')).toEqual(size(3000, 4000));
  });

  it('små filer (under prefetch-størrelsen) og alle formater', async () => {
    const files: [string, Uint8Array, { width: number; height: number }][] = [
      ['a.png', png(2, 3), size(2, 3)],
      ['a.gif', gif(4, 5), size(4, 5)],
      ['a.webp', webpVp8x(6, 7), size(6, 7)],
      ['a.svg', svg('<svg viewBox="0 0 8 9"/>'), size(8, 9)],
    ];
    for (const [name, bytes, expected] of files) {
      await writeFile(join(dir, name), bytes);
      expect(await readImageSizeFromFile(join(dir, name), name.split('.')[1]!), name).toEqual(expected);
    }
  });

  it('manglende fil, mappe, tom fil og ukjent endelse gir null uten unntak', async () => {
    await writeFile(join(dir, 'tom.png'), new Uint8Array(0));
    await writeFile(join(dir, 'bilde.avif'), png(1, 1));
    expect(await readImageSizeFromFile(join(dir, 'finnes-ikke.png'), 'png')).toBeNull();
    expect(await readImageSizeFromFile(join(dir, 'mappe.png'), 'png')).toBeNull();
    expect(await readImageSizeFromFile(join(dir, 'tom.png'), 'png')).toBeNull();
    expect(await readImageSizeFromFile(join(dir, 'bilde.avif'), 'avif')).toBeNull();
  });
});

it('canReadImageSize: bare formatene vi kan lese', () => {
  expect(['png', 'JPG', 'jpeg', 'gif', 'webp', 'svg'].every(canReadImageSize)).toBe(true);
  expect(['avif', 'bmp', 'ico', 'md', ''].some(canReadImageSize)).toBe(false);
});
