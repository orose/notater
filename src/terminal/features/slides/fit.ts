// Tilpasning i terminalen (ADR-011 §4 «Tilpasningen (A2) i rader og kolonner», AR-3-18): samme `fitDraft`/`packUnits`
// som web, men målt i rader. Tetthet `[1]` (designsystem-terminal §1.3): bare deling mellom blokker, ingen krymping.
// En blokk som er for stor alene, får intern rulling. Innledningen (S6) står på tittelsiden når den får plass.

import type { NoteDocument } from '../../../shared/api-types';
import { draftContentKey, fitDraft, agendaSubtitles, footnotesOf, type DeckFit, type DraftFit, type Geometry, type SlideDraft, type SlideDraftDeck } from '../../../core/presentation';
import type { DeckFitter } from '../session';
import { createTheme } from '../theme';
import { gridFor, type Grid } from './grid';
import { blockContext, bodyTop, footnoteRows, titleRoomForPreamble, unitRows, usesMarginalia } from './slide-view';

/** Tetthetstrinnene (UX: bare deling). */
export const TERMINAL_FIT_STEPS: readonly number[] = [1];
/** Øk når tegningen endrer høyder (cachenøkkel, som `LAYOUT_VERSION` i web). */
export const TERMINAL_LAYOUT_VERSION = 1;

/** Høyder avhenger ikke av farger; målingen bruker et fast tema. */
const MEASURE_THEME = createTheme('fosfor', 'dark', 'truecolor');

/** Enhetenes rader på lysbildet: [top, bottom) med én tom rad mellom blokker (ingen mellom punkter i samme liste). */
export function measureDraft(draft: SlideDraft, doc: NoteDocument, grid: Grid): Geometry {
  const ctx = blockContext({ deck: { title: '', agenda: [], slides: [], compactAgendaLine: false, complete: true, validLevels: [], slideLevel: null }, doc, theme: MEASURE_THEME, obsidianVault: '' }, grid);
  const heading = draft.continued ? `${draft.heading ?? ''} (forts.)` : draft.heading;
  const notes = footnotesOf(draft.units);
  const noteRows = notes.length > 0 && !usesMarginalia(grid) ? footnoteRows(notes, ctx, grid.maal).length + 1 : 0;
  const available = grid.bottom - noteRows - bodyTop(grid, heading) + 1;
  const units: Array<{ top: number; bottom: number }> = [];
  let y = 0;
  draft.units.forEach((unit, i) => {
    const sameList = i > 0 && unit.listKey !== null && draft.units[i - 1]?.listKey === unit.listKey;
    if (i > 0 && !sameList) y += 1;
    const h = unitRows(unit, ctx).length;
    units.push({ top: y, bottom: y + h });
    y += h;
  });
  // `packUnits` tåler én enhet over (H = available + 1, laget for piksler); i rader skal det passe eksakt.
  return { available: available - 1, fits: y <= available, units };
}

export function fitTerminalDraft(draft: SlideDraft, doc: NoteDocument, grid: Grid): DraftFit {
  const geometry = measureDraft(draft, doc, grid);
  return fitDraft({ measure: () => geometry, steps: TERMINAL_FIT_STEPS, overflow: draft.units.map((u) => u.overflow) });
}

/** Tilpasningen for en størrelse, med cache per innhold og størrelse (`draftContentKey` + `cols×rows` + versjon). */
export function createTerminalFitter(cols: number, rows: number, cache: Map<string, DraftFit> = new Map()): DeckFitter {
  const grid = gridFor(cols, rows);
  return (deck: SlideDraftDeck, doc: NoteDocument): DeckFit => {
    const subtitles = agendaSubtitles(deck);
    const drafts: Record<string, DraftFit> = {};
    for (const draft of deck.drafts) {
      if (draft.kind !== 'content' && !draft.preamble) continue;
      const key = `${TERMINAL_LAYOUT_VERSION}|${cols}x${rows}|${draftContentKey(draft, deck, subtitles, doc)}`;
      let fit = cache.get(key);
      if (!fit) {
        fit = fitTerminalDraft(draft, doc, grid);
        if (draft.preamble) {
          const measured = measureDraft(draft, doc, grid);
          const height = measured.units.at(-1)?.bottom ?? 0;
          if (fit.breaks.length === 0 && fit.scrollUnits.length === 0 && height + 1 <= titleRoomForPreamble(deck.title, doc, grid)) fit = { ...fit, onTitle: true };
        }
        cache.set(key, fit);
      }
      drafts[draft.baseId] = fit;
    }
    return { drafts, compactAgendaLine: false, complete: true };
  };
}
