import { mkdir, mkdtemp, rename, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInlineMetaExtractor } from './meta-extractor';
import { buildSnapshot, findByDocPath, updateSnapshot } from './vault-snapshot';

let root: string;

async function put(path: string, content: string | Uint8Array): Promise<void> {
  await mkdir(join(root, path, '..'), { recursive: true });
  await writeFile(join(root, path), content);
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vr-snapshot-'));
  await put('Velkommen.md', '---\ntags: [meta]\n---\n# Velkommen\nSe [[Kunde]].');
  await put('domene/Kunde.md', '# Kunde');
  await put('edge/Årsrapport.md', '# NFD');
  await put('Oppgaver.base', 'views: []');
  await put('attachments/logo.svg', '<svg/>');
  await put('.obsidian/plugins/x/README.md', '#task');
  await put('.trash/Slettet.md', '#task');
  await put('Maler/Mal.md', '# Mal');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('buildSnapshot', () => {
  it('indekserer notater, baser og vedlegg; ignorerer dot-mapper og konfigurerte prefikser', async () => {
    const snap = await buildSnapshot(root, ['Maler/'], createInlineMetaExtractor());
    expect([...snap.files.keys()].sort()).toEqual([
      'Oppgaver.base',
      'Velkommen.md',
      'attachments/logo.svg',
      'domene/Kunde.md',
      'edge/Årsrapport.md',
    ]);
    expect(snap.notes.get('Velkommen.md')!.meta.tags).toEqual(['meta']);
    expect(snap.notes.get('Velkommen.md')!.body).toBe('# Velkommen\nSe [[Kunde]].');
    expect(snap.baseSources.get('Oppgaver.base')).toBe('views: []');
  });

  it('normaliserer NFD til NFC, men husker disk-stien', async () => {
    const snap = await buildSnapshot(root, [], createInlineMetaExtractor());
    const file = snap.files.get('edge/Årsrapport.md')!;
    expect(file.docPath).toBe('edge/Årsrapport');
    expect(file.diskPath).toBe('edge/Årsrapport.md');
  });

  it('ignorerer symlenker som peker ut av vaultet', async () => {
    const outside = await mkdtemp(join(tmpdir(), 'vr-outside-'));
    await writeFile(join(outside, 'hemmelig.md'), 'HEMMELIG');
    await symlink(join(outside, 'hemmelig.md'), join(root, 'lenke.md'));
    const snap = await buildSnapshot(root, [], createInlineMetaExtractor());
    expect(snap.files.has('lenke.md')).toBe(false);
    await rm(outside, { recursive: true, force: true });
  });
});

describe('findByDocPath', () => {
  it('eksakt sti, så med .md, NFC-normalisert', async () => {
    const snap = await buildSnapshot(root, [], createInlineMetaExtractor());
    expect(findByDocPath(snap, 'domene/Kunde')?.filePath).toBe('domene/Kunde.md');
    expect(findByDocPath(snap, 'Oppgaver.base')?.filePath).toBe('Oppgaver.base');
    expect(findByDocPath(snap, 'edge/Årsrapport')?.filePath).toBe('edge/Årsrapport.md');
    expect(findByDocPath(snap, '../etc/passwd')).toBeNull();
    expect(findByDocPath(snap, 'domene/kunde')).toBeNull();
  });
});

describe('updateSnapshot (inkrementell)', () => {
  it('legger til, endrer og fjerner filer og rapporterer endringene', async () => {
    const extractor = createInlineMetaExtractor();
    const snap = await buildSnapshot(root, [], extractor);
    await put('Ny.md', '# Ny #tagg');
    await put('domene/Kunde.md', '# Kunde endret');
    await unlink(join(root, 'Oppgaver.base'));

    const result = await updateSnapshot(snap, root, [], ['Ny.md', 'domene/Kunde.md', 'Oppgaver.base', '.obsidian/x.md'], extractor);

    expect(result.changes).toEqual([
      { type: 'added', path: 'Ny' },
      { type: 'changed', path: 'domene/Kunde' },
      { type: 'removed', path: 'Oppgaver.base' },
    ]);
    expect(result.snapshot.notes.get('Ny.md')!.meta.tags).toEqual(['tagg']);
    expect(result.snapshot.notes.get('domene/Kunde.md')!.body).toBe('# Kunde endret');
    expect(result.snapshot.files.has('Oppgaver.base')).toBe(false);
    expect(result.snapshot.baseSources.has('Oppgaver.base')).toBe(false);
    // Gammelt snapshot er urørt (immutabelt).
    expect(snap.files.has('Ny.md')).toBe(false);
  });

  it('omdøping (fs.rename) i samme batch gir i tillegg en renamed-endring (PO-49)', async () => {
    const extractor = createInlineMetaExtractor();
    const snap = await buildSnapshot(root, [], extractor);
    await mkdir(join(root, 'kunder'), { recursive: true });
    await rename(join(root, 'domene/Kunde.md'), join(root, 'kunder/Kunde ny.md'));
    await rename(join(root, 'attachments/logo.svg'), join(root, 'attachments/logo2.svg'));
    const result = await updateSnapshot(snap, root, [], ['domene/Kunde.md', 'kunder/Kunde ny.md', 'attachments/logo.svg', 'attachments/logo2.svg'], extractor);
    expect(result.changes).toEqual([
      { type: 'removed', path: 'domene/Kunde' },
      { type: 'added', path: 'kunder/Kunde ny' },
      { type: 'removed', path: 'attachments/logo.svg' },
      { type: 'added', path: 'attachments/logo2.svg' },
      { type: 'renamed', path: 'kunder/Kunde ny', from: 'domene/Kunde', to: 'kunder/Kunde ny' },
      { type: 'renamed', path: 'attachments/logo2.svg', from: 'attachments/logo.svg', to: 'attachments/logo2.svg' },
    ]);
  });

  it('kopi + sletting med identisk innhold (ny inode) regnes også som omdøping; ulikt innhold gjør ikke', async () => {
    const extractor = createInlineMetaExtractor();
    const snap = await buildSnapshot(root, [], extractor);
    await put('Kunde kopi.md', '# Kunde');
    await unlink(join(root, 'domene/Kunde.md'));
    await put('Annet.md', '# Noe helt annet');
    await unlink(join(root, 'Velkommen.md'));
    const result = await updateSnapshot(snap, root, [], ['domene/Kunde.md', 'Kunde kopi.md', 'Velkommen.md', 'Annet.md'], extractor);
    expect(result.changes.filter((c) => c.type === 'renamed')).toEqual([
      { type: 'renamed', path: 'Kunde kopi', from: 'domene/Kunde', to: 'Kunde kopi' },
    ]);
  });

  it('slettet mappe fjerner alle filer under den', async () => {
    const extractor = createInlineMetaExtractor();
    const snap = await buildSnapshot(root, [], extractor);
    await rm(join(root, 'domene'), { recursive: true });
    const result = await updateSnapshot(snap, root, [], ['domene'], extractor);
    expect(result.changes).toEqual([{ type: 'removed', path: 'domene/Kunde' }]);
  });

  it('uendret fil gir ingen endring', async () => {
    const extractor = createInlineMetaExtractor();
    const snap = await buildSnapshot(root, [], extractor);
    const result = await updateSnapshot(snap, root, [], ['Velkommen.md'], extractor);
    expect(result.changes).toEqual([]);
    expect(result.snapshot).toBe(snap);
  });
});

/** Minste PNG-header vi trenger: signatur + IHDR med bredde/høyde. */
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

describe('bildedimensjoner i indeksen (PO-71)', () => {
  it('leses ved indeksering for bildevedlegg; ukjent/ødelagt gir null, andre filer får ingen verdi', async () => {
    await put('attachments/bilde.png', pngHeader(320, 180));
    await put('attachments/tegning.svg', '<svg viewBox="0 0 40 30"/>');
    await put('attachments/ødelagt.jpg', 'ikke et bilde');
    await put('attachments/dokument.pdf', '%PDF');
    const snap = await buildSnapshot(root, [], createInlineMetaExtractor());
    expect(snap.files.get('attachments/bilde.png')!.imageSize).toEqual({ width: 320, height: 180 });
    expect(snap.files.get('attachments/tegning.svg')!.imageSize).toEqual({ width: 40, height: 30 });
    expect(snap.files.get('attachments/logo.svg')!.imageSize).toBeNull();
    expect(snap.files.get('attachments/ødelagt.jpg')!.imageSize).toBeNull();
    expect(snap.files.get('attachments/dokument.pdf')!.imageSize).toBeUndefined();
    expect(snap.files.get('Velkommen.md')!.imageSize).toBeUndefined();
  });

  it('invalideres når fila endres (live reload); uendrede bilder beholder cachet verdi', async () => {
    await put('attachments/bilde.png', pngHeader(320, 180));
    await put('attachments/annet.png', pngHeader(10, 10));
    const extractor = createInlineMetaExtractor();
    const snap = await buildSnapshot(root, [], extractor);
    const untouched = snap.files.get('attachments/annet.png')!;

    await put('attachments/bilde.png', Uint8Array.from([...pngHeader(1600, 900), 0, 0, 0])); // ny størrelse på disk
    await put('attachments/nytt.png', pngHeader(5, 6));
    const result = await updateSnapshot(snap, root, [], ['attachments/bilde.png', 'attachments/nytt.png', 'attachments/annet.png'], extractor);

    expect(result.changes).toEqual([
      { type: 'changed', path: 'attachments/bilde.png' },
      { type: 'added', path: 'attachments/nytt.png' },
    ]);
    expect(result.snapshot.files.get('attachments/bilde.png')!.imageSize).toEqual({ width: 1600, height: 900 });
    expect(result.snapshot.files.get('attachments/nytt.png')!.imageSize).toEqual({ width: 5, height: 6 });
    expect(result.snapshot.files.get('attachments/annet.png')).toBe(untouched);
    expect(snap.files.get('attachments/bilde.png')!.imageSize).toEqual({ width: 320, height: 180 });
  });

  it('et bilde som blir ødelagt mister dimensjonene uten feil', async () => {
    await put('attachments/bilde.png', pngHeader(320, 180));
    const extractor = createInlineMetaExtractor();
    const snap = await buildSnapshot(root, [], extractor);
    await put('attachments/bilde.png', 'avkortet under synk');
    const result = await updateSnapshot(snap, root, [], ['attachments/bilde.png'], extractor);
    expect(result.snapshot.files.get('attachments/bilde.png')!.imageSize).toBeNull();
  });
});

describe('buildSnapshot mot test-vault (QA-IDX-01/02)', () => {
  it('106 notater og 9 andre filer', async () => {
    const snap = await buildSnapshot(join(process.cwd(), 'test-vault'), [], createInlineMetaExtractor());
    const files = [...snap.files.values()];
    expect(files.filter((f) => f.ext === 'md')).toHaveLength(106);
    expect(files.filter((f) => f.ext !== 'md')).toHaveLength(9);
  });
});
