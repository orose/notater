// Veien NoteDocument → lysbildemodellens kilde (ADR-011 §1, AR-3-03). Finnes ett sted, så web og terminal ikke kan
// divergere: splitLeadingTitle → prepareContent → buildOutline(diskré embedding på, S1) → fromOutline.

import type { NoteDocument } from '../../shared/api-types';
import { prepareContent, splitLeadingTitle } from '../hast';
import { buildOutline } from '../outline';
import { buildSlideDrafts, finalizeDeck, fromOutline, type HeadingLevel, type SlideSource } from './model';

export interface PreparedSlideSource {
  readonly doc: NoteDocument;
  readonly title: string;
  readonly source: SlideSource;
}

/** Et gyldig lysbildenivå for notatet, med agendanivået det gir og antall lysbilder (`:presenter`-underlisten). */
export interface LevelInfo {
  readonly level: HeadingLevel;
  readonly agendaLevel: HeadingLevel | null;
  readonly slides: number;
}

const preparedCache = new WeakMap<NoteDocument, PreparedSlideSource>();

/** Dokument → disposisjon med diskré embedding alltid på (S1) → modellens kilde. Memoisert per dokumentobjekt. */
export function prepareSlideSource(doc: NoteDocument): PreparedSlideSource {
  const hit = preparedCache.get(doc);
  if (hit) return hit;
  const display = splitLeadingTitle(doc);
  const outline = buildOutline(prepareContent(display.content), display.toc, true);
  const prepared = { doc, title: display.title, source: fromOutline(outline, display.title) };
  preparedCache.set(doc, prepared);
  return prepared;
}

/** Nivåene notatet har overskrifter på, med agendanivå og antall lysbilder (uten tilpasning, med overganger). */
export function presentationLevelInfo(source: SlideSource): readonly LevelInfo[] {
  const auto = buildSlideDrafts(source, { slideLevel: null });
  return auto.validLevels.map((l) => {
    const d = buildSlideDrafts(source, { slideLevel: l });
    const count = finalizeDeck(d, { drafts: {}, compactAgendaLine: false, complete: false }, { transitions: true }).slides.length;
    return { level: l, agendaLevel: d.agendaLevel, slides: count };
  });
}
