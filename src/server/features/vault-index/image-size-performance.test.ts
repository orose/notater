/**
 * AK17/PO-71: å lese bildedimensjoner ved indeksering skal ikke merkbart påvirke indekseringstiden.
 * Et syntetisk vault med 200 notater og 1000 bilder (png, gif, webp, svg, jpeg – noen JPEG-er med 256 KiB
 * EXIF/ICC før SOF) indekseres med og uten bildeendelser. Merkostnaden skal være godt under AK17-budsjettet
 * på 3 s (vi krever < 10 % av det), og per bilde under 0,3 ms.
 */
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createInlineMetaExtractor } from './meta-extractor';
import { buildSnapshot } from './vault-snapshot';

const IMAGE_COUNT = 1000;
const NOTE_COUNT = 200;
const AK17_BUDGET_MS = 3000;
const MAX_OVERHEAD_MS = AK17_BUDGET_MS * 0.1;

const be32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const be16 = (n: number): number[] => [(n >>> 8) & 0xff, n & 0xff];
const le16 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff];

/** Header + fyll, så filene har realistisk størrelse (bildedata leses aldri). */
function image(ext: string, i: number): Uint8Array | string {
  const w = 100 + i;
  const h = 50 + i;
  const fill = new Array<number>(8 * 1024).fill(0x55);
  switch (ext) {
    case 'png':
      return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(w), ...be32(h), 8, 2, 0, 0, 0, ...fill]);
    case 'gif':
      return Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...le16(w), ...le16(h), 0, 0, 0, ...fill]);
    case 'webp':
      return Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0, w - 1, (w - 1) >> 8, 0, h - 1, (h - 1) >> 8, 0, ...fill]);
    case 'svg':
      return `<?xml version="1.0"?>\n<!-- generert -->\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${'<rect/>'.repeat(500)}</svg>`;
    default: {
      // JPEG; hver fjerde med 256 KiB APP2-segmenter før SOF (som ICC-profiler i ekte foto).
      const padding: number[] = [];
      if (i % 20 === 1) for (let s = 0; s < 4; s++) padding.push(0xff, 0xe2, 0xff, 0xff, ...new Array<number>(0xfffd).fill(0x41));
      return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, ...padding, 0xff, 0xc0, 0, 11, 8, ...be16(h), ...be16(w), 1, 1, 0x11, 0, ...fill]);
    }
  }
}

const EXTS = ['png', 'jpg', 'gif', 'webp', 'svg'];
let withImages: string;
let withoutImages: string;

async function makeVault(imageExtensions: boolean): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vr-image-perf-'));
  await mkdir(join(root, 'attachments'));
  await mkdir(join(root, 'notater'));
  for (let i = 0; i < NOTE_COUNT; i++) {
    await writeFile(join(root, 'notater', `Notat ${i}.md`), `---\ntags: [x]\n---\n# Notat ${i}\n\n![[bilde-${i}.png|300]]\n\nTekst [[Notat ${(i + 1) % NOTE_COUNT}]].\n`);
  }
  for (let i = 0; i < IMAGE_COUNT; i++) {
    const ext = EXTS[i % EXTS.length]!;
    const name = `bilde-${i}.${ext}`;
    await writeFile(join(root, 'attachments', name), image(ext, i));
    // Kontrollvaultet har de samme bytene, men endelser vi ikke leser dimensjoner for.
    if (!imageExtensions) await rename(join(root, 'attachments', name), join(root, 'attachments', `${name}.dat`));
  }
  return root;
}

async function medianIndexMs(root: string, runs = 5): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const started = performance.now();
    await buildSnapshot(root, [], createInlineMetaExtractor());
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]!;
}

beforeAll(async () => {
  [withImages, withoutImages] = await Promise.all([makeVault(true), makeVault(false)]);
}, 120_000);

afterAll(async () => {
  await Promise.all([withImages, withoutImages].filter(Boolean).map((root) => rm(root, { recursive: true, force: true })));
});

it(`dimensjoner for ${IMAGE_COUNT} bilder øker indekseringstiden med < ${MAX_OVERHEAD_MS} ms (AK17)`, async () => {
  const snapshot = await buildSnapshot(withImages, [], createInlineMetaExtractor());
  const sized = [...snapshot.files.values()].filter((f) => f.imageSize);
  expect(sized).toHaveLength(IMAGE_COUNT);
  expect(snapshot.files.get('attachments/bilde-12.gif')!.imageSize).toEqual({ width: 112, height: 62 });
  expect(snapshot.files.get('attachments/bilde-21.jpg')!.imageSize).toEqual({ width: 121, height: 71 }); // med 256 KiB APP2
  expect(snapshot.files.get('attachments/bilde-6.jpg')!.imageSize).toEqual({ width: 106, height: 56 });
  expect(snapshot.files.get('attachments/bilde-303.webp')!.imageSize).toEqual({ width: 403, height: 353 });

  // Annenhver rekkefølge jevner ut varm/kald filcache.
  const control1 = await medianIndexMs(withoutImages);
  const measured1 = await medianIndexMs(withImages);
  const measured2 = await medianIndexMs(withImages);
  const control2 = await medianIndexMs(withoutImages);
  const control = (control1 + control2) / 2;
  const measured = (measured1 + measured2) / 2;
  const overhead = measured - control;
  console.info(`[PO-71] indeksering uten bildedimensjoner ${Math.round(control)} ms, med ${Math.round(measured)} ms, merkostnad ${Math.round(overhead)} ms for ${IMAGE_COUNT} bilder`);
  expect(overhead).toBeLessThan(MAX_OVERHEAD_MS);
  expect(overhead / IMAGE_COUNT).toBeLessThan(0.3);
}, 120_000);
