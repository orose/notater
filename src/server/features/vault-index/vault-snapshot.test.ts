import { mkdir, mkdtemp, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInlineMetaExtractor } from './meta-extractor';
import { buildSnapshot, findByDocPath, updateSnapshot } from './vault-snapshot';

let root: string;

async function put(path: string, content: string): Promise<void> {
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

describe('buildSnapshot mot test-vault (QA-IDX-01/02)', () => {
  it('80 notater og 9 andre filer', async () => {
    const snap = await buildSnapshot(join(process.cwd(), 'test-vault'), [], createInlineMetaExtractor());
    const files = [...snap.files.values()];
    expect(files.filter((f) => f.ext === 'md')).toHaveLength(80);
    expect(files.filter((f) => f.ext !== 'md')).toHaveLength(9);
  });
});
