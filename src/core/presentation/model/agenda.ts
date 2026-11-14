// Hjelpere for agenda-, overgangs- og oversiktslysbildene (L2/L3, designsystem §12.4). Ren TS.

import type { SlideDeck, SlideDraftDeck } from './slide-types';

/** Delpunktene under hvert agendapunkt: titlene på punktets innholdslysbilder, uten «(forts.)» og punktet selv. */
export function agendaSubtitles(drafts: SlideDraftDeck): string[][] {
  const out = drafts.agenda.map(() => [] as string[]);
  for (const d of drafts.drafts) {
    if (d.kind !== 'content' || d.continued || d.heading === null || d.address.agenda === null) continue;
    const item = drafts.agenda[d.address.agenda];
    const list = out[d.address.agenda];
    if (!item || !list || d.heading === item.text || list.includes(d.heading)) continue;
    list.push(d.heading);
  }
  return out;
}

/** Lysbildenummeret der hvert agendapunkt starter (overgangen, eller første innhold med `:agenda av`). */
export function agendaStartNumbers(deck: SlideDeck): number[] {
  return deck.agenda.map((item) => deck.slides.find((s) => s.agendaIndex === item.index)?.number ?? 0);
}

/** Start-lysbildet for en overskrift i lesevisningen (ADR-010 §4): første lysbilde som dekker id-en, ellers tittelen. */
export function slideForHeading(deck: SlideDeck, headingId: string | null): number {
  if (!headingId) return 0;
  const i = deck.slides.findIndex((s) => s.sourceHeadingIds.includes(headingId));
  return i === -1 ? 0 : i;
}

/** Overskriften i notatet for lysbildet `index` (PO-87): nærmeste lysbilde bakover som dekker en overskrift. */
export function headingForSlide(deck: SlideDeck, index: number, exists: (id: string) => boolean = () => true): string | null {
  for (let i = Math.min(index, deck.slides.length - 1); i >= 0; i--) {
    for (const id of deck.slides[i]?.sourceHeadingIds ?? []) if (exists(id)) return id;
  }
  return null;
}
