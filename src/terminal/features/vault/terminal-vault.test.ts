import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInlineMetaExtractor } from '../../../server/features/vault-index';
import type { VaultState } from '../../../server/features/vault-registry';
import { noteLanguages, openTerminalVault, type TerminalVault } from './terminal-vault';

const ROOT = fileURLToPath(new URL('../../../../test-vault', import.meta.url));

let vault: TerminalVault;
let state: VaultState;
const progress: Array<[number, number]> = [];

beforeAll(async () => {
  vault = openTerminalVault(
    { id: 'test', name: 'test-vault', root: ROOT, ignore: [], hiddenProperties: [] },
    { watch: false, createInitialExtractor: createInlineMetaExtractor, onProgress: (d, t) => progress.push([d, t]) },
  );
  state = await vault.ready();
}, 60_000);

afterAll(() => vault.close());

describe('terminalens vault (ADR-011 §2)', () => {
  it('indekserer test-vault med fremdrift og uten bakgrunnsarbeid', () => {
    expect(progress.at(-1)?.[0]).toBe(progress.at(-1)?.[1]);
    expect(vault.notes(state).length).toBeGreaterThan(20);
    expect(vault.notes(state).every((n) => !n.filePath.endsWith('.base'))).toBe(true);
  });

  it('slår opp notater etter navn og gir NoteDocument som API-et', async () => {
    const hit = vault.lookup(state, 'Statusmøte uke 45');
    expect(hit).toEqual({ kind: 'note', docPath: 'presentasjon/Statusmøte uke 45' });
    const doc = await vault.document('presentasjon/Statusmøte uke 45');
    expect(doc?.kind).toBe('note');
    expect(doc?.title).toBeTruthy();
    expect(await vault.document('finnes/ikke')).toBeNull();
  }, 30_000);

  it('laster bare språkene notatet trenger, og koden fargelegges (M1)', async () => {
    const file = [...state.snapshot.notes.values()].find((n) => n.file.docPath === 'presentasjon/Stor kodeblokk');
    expect(file).toBeDefined();
    const langs = noteLanguages(state, file!.file.filePath);
    expect(langs.length).toBeGreaterThan(0);
    const doc = await vault.document('presentasjon/Stor kodeblokk');
    expect(JSON.stringify(doc?.content)).toContain('--shiki-token');
  }, 30_000);
});
