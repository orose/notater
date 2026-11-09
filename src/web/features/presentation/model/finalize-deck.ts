// Trinn 2 i lysbildemodellen (ADR-010 §1): utkast + tilpasning → ferdig kortstokk. A2-fortsettelser («(forts.)»),
// `:agenda av`, nummer, progresjon innen agendapunktet, fotnoter (A4) og etiketter til skjermleser. Ren TS.

import type { Element, ElementContent, RootContent } from 'hast';
import { formatSlideId } from './slide-id';
import type { DraftFit, FinalizeDeck, Slide, SlideDraft, SlideFootnote, SlideUnit } from './slide-types';

/** Teksten som legges til overskriften på delte lysbilder (S5, A2). */
export const CONTINUED_SUFFIX = ' (forts.)';

const UNMEASURED_FIT: DraftFit = { scale: 1, breaks: [], scrollUnits: [] };

type Node = RootContent | ElementContent;

function collectSidenotes(node: Node, into: SlideFootnote[]): void {
  if (node.type !== 'element') return;
  if (node.tagName === 'vr-sidenote') {
    into.push({ number: String(node.properties.dataNumber ?? into.length + 1), content: node.children });
    return;
  }
  for (const child of (node as Element).children) collectSidenotes(child, into);
}

function footnotesOf(units: readonly SlideUnit[]): SlideFootnote[] {
  const out: SlideFootnote[] = [];
  for (const unit of units) collectSidenotes(unit.node, out);
  return out;
}

/** Bruddpunktene som gir gyldige, ikke-tomme deler. */
function chunks(units: readonly SlideUnit[], breaks: readonly number[]): Array<readonly [number, number]> {
  const cuts = [...new Set(breaks)].filter((b) => b > 0 && b < units.length).sort((a, b) => a - b);
  const bounds = [0, ...cuts, units.length];
  return bounds.slice(0, -1).map((start, i) => [start, bounds[i + 1] as number] as const);
}

type Draft = Omit<Slide, 'number' | 'label' | 'progress'>;

export const finalizeDeck: FinalizeDeck = (deck, fit, options) => {
  const fitOf = (d: SlideDraft): DraftFit => fit.drafts[d.baseId] ?? UNMEASURED_FIT;
  const preamble = deck.drafts.filter((d) => d.preamble);
  const onTitle = preamble.length === 1 && fitOf(preamble[0] as SlideDraft).onTitle === true;
  const slides: Draft[] = [];

  for (const d of deck.drafts) {
    if (d.kind === 'transition' && !options.transitions) continue;
    if (d.preamble && onTitle) continue;
    if (d.kind === 'title') {
      const pre = onTitle ? (preamble[0] as SlideDraft) : null;
      const f = pre ? fitOf(pre) : UNMEASURED_FIT;
      slides.push({
        id: d.baseId,
        kind: 'title',
        address: { ...d.address, continuation: 1 },
        heading: d.heading,
        units: pre?.units ?? [],
        scale: f.scale,
        scrollUnits: [],
        footnotes: pre ? footnotesOf(pre.units) : [],
        agendaIndex: null,
        withPreamble: pre !== null,
        sourceHeadingIds: pre?.sourceHeadingIds ?? [],
      });
      continue;
    }
    if (d.kind !== 'content') {
      slides.push({
        id: d.baseId,
        kind: d.kind,
        address: { ...d.address, continuation: 1 },
        heading: d.heading,
        units: [],
        scale: 1,
        scrollUnits: [],
        footnotes: [],
        agendaIndex: d.address.agenda,
        withPreamble: false,
        sourceHeadingIds: d.sourceHeadingIds,
      });
      continue;
    }
    // Tom agendaseksjon: bare overgangen; uten overganger et lysbilde med kun overskriften (ADR-010 §1, regel 4).
    if (d.units.length === 0 && options.transitions) continue;
    const f = fitOf(d);
    const parts = d.units.length === 0 ? [[0, 0] as const] : chunks(d.units, f.breaks);
    parts.forEach(([start, end], c) => {
      const units = d.units.slice(start, end);
      const continued = d.continued || c > 0;
      slides.push({
        id: formatSlideId(d.baseId, 1, c + 1),
        kind: 'content',
        address: { ...d.address, continuation: c + 1 },
        heading: d.heading === null ? null : continued ? `${d.heading}${CONTINUED_SUFFIX}` : d.heading,
        units,
        scale: f.scale,
        scrollUnits: f.scrollUnits.filter((i) => i >= start && i < end).map((i) => i - start),
        footnotes: footnotesOf(units),
        agendaIndex: d.address.agenda,
        withPreamble: false,
        sourceHeadingIds: c === 0 ? d.sourceHeadingIds : [],
      });
    });
  }

  const total = slides.length;
  const perAgenda = new Map<number, number>();
  for (const s of slides) if (s.kind === 'content' && s.agendaIndex !== null) perAgenda.set(s.agendaIndex, (perAgenda.get(s.agendaIndex) ?? 0) + 1);
  const seen = new Map<number, number>();
  const labelOf = (s: Draft): string => {
    if (s.kind === 'agenda') return 'Agenda';
    if (s.kind === 'transition') return `Agenda: ${deck.agenda[s.agendaIndex ?? -1]?.text ?? ''}`;
    if (s.heading !== null) return s.heading;
    return s.address.continuation > 1 || s.address.part > 1 ? `${deck.title}${CONTINUED_SUFFIX}` : deck.title;
  };

  return {
    title: deck.title,
    agenda: deck.agenda,
    slides: slides.map((s, i): Slide => {
      let progress: Slide['progress'] = null;
      if (s.kind === 'content' && s.agendaIndex !== null) {
        const index = (seen.get(s.agendaIndex) ?? 0) + 1;
        seen.set(s.agendaIndex, index);
        progress = { index, count: perAgenda.get(s.agendaIndex) ?? index };
      }
      return { ...s, number: i + 1, progress, label: `Lysbilde ${i + 1} av ${total}: ${labelOf(s)}` };
    }),
    compactAgendaLine: fit.compactAgendaLine,
    complete: fit.complete,
    validLevels: deck.validLevels,
    slideLevel: deck.slideLevel,
  };
};
