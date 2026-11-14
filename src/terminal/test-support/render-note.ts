// Testhjelper (ADR-011 §8 nivå 2): bygger vaultet over test-vault/ én gang per testfil og tegner hele kortstokken
// for et notat med samme kode som kjøringen, uten terminal.

import { fileURLToPath } from 'node:url';
import type { NoteDocument } from '../../shared/api-types';
import { createInlineMetaExtractor } from '../../server/features/vault-index';
import type { ColorDepth, Frame } from '../features/cells';
import { buildDeck } from '../features/session';
import { createTerminalFitter, slideView } from '../features/slides';
import { createTheme, type PaletteName, type ThemeMode } from '../features/theme';
import { openTerminalVault, type TerminalVault } from '../features/vault';

export const TEST_VAULT = fileURLToPath(new URL('../../../test-vault', import.meta.url));

let vault: TerminalVault | null = null;

export function testVault(): TerminalVault {
  vault ??= openTerminalVault({ id: 'test', name: 'test-vault', root: TEST_VAULT, ignore: [], hiddenProperties: [] }, { watch: false, createInitialExtractor: createInlineMetaExtractor });
  return vault;
}

export async function loadNote(docPath: string): Promise<NoteDocument> {
  const doc = await testVault().document(docPath);
  if (!doc) throw new Error(`Fant ikke ${docPath} i test-vault`);
  return doc;
}

export interface RenderOptions {
  readonly cols: number;
  readonly rows: number;
  readonly palette?: PaletteName;
  readonly mode?: ThemeMode;
  readonly depth?: ColorDepth;
}

export async function renderDeck(docPath: string, options: RenderOptions): Promise<{ doc: NoteDocument; frames: Frame[] }> {
  const doc = await loadNote(docPath);
  const deck = buildDeck(doc, { level: null, transitions: true }, createTerminalFitter(options.cols, options.rows));
  const theme = createTheme(options.palette ?? 'fosfor', options.mode ?? 'dark', options.depth ?? 'truecolor');
  const frames = deck.slides.map((_, i) => slideView({ deck, doc, theme, obsidianVault: 'test-vault' }, i, options.cols, options.rows));
  return { doc, frames };
}
