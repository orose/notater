// Trinn 1 i lysbildemodellen (ADR-010 §1): disposisjonens flyt → utkast etter S1–S8. Ren TS, uavhengig av layout.

import GithubSlugger from 'github-slugger';
import type { Element, ElementContent, RootContent } from 'hast';
import type { Outline } from '../../outline';
import { AGENDA_SLIDE_ID, PREAMBLE_SLIDE_ID, RESERVED_SLIDE_KEYS, TITLE_SLIDE_ID, formatSlideId, transitionSlideId } from './slide-id';
import type {
  AgendaItem,
  BuildSlideDrafts,
  FlowBlock,
  HeadingLevel,
  SlideDraft,
  SlideSource,
  SlideUnit,
  UnitOverflow,
} from './slide-types';

type Node = RootContent | ElementContent;

/** Kilden til modellen: notattittelen og disposisjonens flyt (bygget med diskré embedding på, S1). */
export function fromOutline(outline: Pick<Outline, 'flow'>, title: string): SlideSource {
  return { title, flow: outline.flow };
}

const SCALE = new Set(['img', 'figure', 'vr-mermaid']);
const SCROLL = new Set(['vr-code', 'table', 'vr-base', 'vr-callout', 'blockquote', 'vr-unsupported', 'vr-embed', 'pre']);

function isElement(node: Node | undefined): node is Element {
  return node?.type === 'element';
}

function isBlank(node: Node): boolean {
  return (node.type === 'text' && node.value.trim() === '') || node.type === 'comment';
}

function overflowOf(node: Node): UnitOverflow {
  if (!isElement(node)) return 'flow';
  if (SCALE.has(node.tagName)) return 'scale';
  if (SCROLL.has(node.tagName)) return 'scroll';
  if (node.tagName === 'p') {
    const content = node.children.filter((c) => !isBlank(c));
    if (content.length === 1 && isElement(content[0]) && content[0].tagName === 'img') return 'scale';
  }
  return 'flow';
}

/** Kopi uten `id` (og referanser til id-er): lesevisningen er fortsatt montert (ADR-010 §1). */
function stripIds<T extends Node>(node: T): T {
  if (!isElement(node)) return node;
  const { id: _id, ariaDescribedBy: _described, ariaLabelledBy: _labelled, ...properties } = node.properties;
  return { ...node, properties, children: node.children.map(stripIds) } as T;
}

/** Én blokk → enheter. En liste på toppnivå deles i listepunkter (A2 bryter mellom punkter, aldri inne i ett). */
function unitsOf(node: Node, nextKey: () => string): SlideUnit[] {
  if (isElement(node) && (node.tagName === 'ul' || node.tagName === 'ol')) {
    const items = node.children.filter((c): c is Element => isElement(c) && c.tagName === 'li');
    if (items.length > 1) {
      const key = nextKey();
      const { id: _id, ...properties } = node.properties;
      return items.map((li, index) => ({
        node: stripIds(li),
        overflow: 'flow' as const,
        listKey: key,
        list: { tagName: node.tagName, properties, index },
      }));
    }
  }
  return [{ node: stripIds(node), overflow: overflowOf(node), listKey: null }];
}

interface Group {
  /** Grunn-id uten `.del`. */
  readonly key: string;
  readonly heading: string | null;
  readonly blocks: FlowBlock[];
  readonly agenda: number | null;
  /** Lysbildets nummer innen agendapunktet (eller blant lysbilder uten agendapunkt). */
  readonly slide: number;
  readonly sourceHeadingIds: string[];
  readonly preamble: boolean;
  /** Agendaseksjon uten innhold: med `:agenda av` et lysbilde med bare overskriften (ADR-010 §1, regel 4). */
  readonly emptySection: boolean;
}

/** S5: `---` deler en gruppe i deler; tomme deler forkastes; del ≥ 2 er «(forts.)». */
function partsOf(group: Group): SlideDraft[] {
  const parts: FlowBlock[][] = [[]];
  for (const block of group.blocks) {
    if (block.thematicBreak) parts.push([]);
    else (parts[parts.length - 1] as FlowBlock[]).push(block);
  }
  const kept = parts.filter((p) => p.length > 0);
  const base = {
    kind: 'content' as const,
    heading: group.heading,
    preamble: group.preamble,
  };
  if (kept.length === 0) {
    if (!group.emptySection) return [];
    return [{ ...base, baseId: group.key, address: { kind: 'content', agenda: group.agenda, slide: group.slide, part: 1 }, continued: false, units: [], sourceHeadingIds: group.sourceHeadingIds }];
  }
  return kept.map((blocks, i) => {
    const ids = i === 0 ? [...group.sourceHeadingIds] : [];
    for (const b of blocks) if (b.heading) ids.push(b.heading.id);
    let lists = 0;
    const nextKey = () => `liste-${++lists}`;
    return {
      ...base,
      baseId: formatSlideId(group.key, i + 1),
      address: { kind: 'content' as const, agenda: group.agenda, slide: group.slide, part: i + 1 },
      continued: i > 0,
      units: blocks.flatMap((b) => unitsOf(b.node, nextKey)),
      sourceHeadingIds: ids,
    };
  });
}

function levelsOf(flow: readonly FlowBlock[]): HeadingLevel[] {
  return [...new Set(flow.flatMap((b) => (b.heading ? [b.heading.level] : [])))].sort((a, b) => a - b);
}

/** S2–S4 (AR-2-03): automatisk `A = min(L)`, `S = A + 1`; `h<n>`: `S = n`, `A` = nærmeste nivå over som finnes. */
export function presentationLevels(levels: readonly HeadingLevel[], override: HeadingLevel | null): { agenda: HeadingLevel | null; slide: HeadingLevel | null } {
  if (override !== null) {
    const above = levels.filter((l) => l < override);
    return { agenda: above.length > 0 ? (above[above.length - 1] as HeadingLevel) : null, slide: override };
  }
  if (levels.length === 0) return { agenda: null, slide: null };
  const agenda = levels[0] as HeadingLevel;
  return { agenda, slide: Math.min(6, agenda + 1) as HeadingLevel };
}

export const buildSlideDrafts: BuildSlideDrafts = (source, options) => {
  const { flow } = source;
  const validLevels = levelsOf(flow);
  const override = options.slideLevel !== null && validLevels.includes(options.slideLevel) ? options.slideLevel : null;
  const { agenda: A, slide: S } = presentationLevels(validLevels, override);
  const hasSlideLevel = S !== null && validLevels.includes(S);

  const slugger = new GithubSlugger();
  for (const key of RESERVED_SLIDE_KEYS) slugger.slug(key);

  const agenda: AgendaItem[] = [];
  const agendaHeadingIds: string[] = [];
  // Innledning (S6), eller innhold uten overskrifter (S7: ikke forsøkt på tittellysbildet).
  const preamble: Group = {
    key: PREAMBLE_SLIDE_ID,
    heading: null,
    blocks: [],
    agenda: null,
    slide: 0,
    sourceHeadingIds: [],
    preamble: validLevels.length > 0,
    emptySection: false,
  };
  const groups: Group[] = [preamble];
  let current = preamble;
  let agendaIndex: number | null = null;
  let perAgenda = 0;
  let loose = 1;
  const open = (group: Omit<Group, 'blocks'>) => {
    current = { ...group, blocks: [] };
    groups.push(current);
  };

  for (const block of flow) {
    const h = block.heading;
    if (h && A !== null && h.level === A) {
      // Agendapunkt (S2): overgang + punktets innledning / eneste lysbilde, med agendapunktets nøkkel.
      agendaIndex = agenda.length;
      const key = slugger.slug(h.text);
      agenda.push({ index: agendaIndex, text: h.text, key });
      agendaHeadingIds.push(h.id);
      perAgenda = 0;
      open({ key, heading: h.text, agenda: agendaIndex, slide: perAgenda++, sourceHeadingIds: [h.id], preamble: false, emptySection: true });
    } else if (h && A !== null && h.level < A) {
      // Over agendanivået (bare ved overstyring, AR-2-04): verken agendapunkt eller eget lysbilde. Eget innhold blir
      // et lysbilde uten agendapunkt; før første agendapunkt hører innholdet til innledningen.
      if (agenda.length === 0) continue;
      agendaIndex = null;
      open({ key: slugger.slug(h.text), heading: h.text, agenda: null, slide: loose++, sourceHeadingIds: [h.id], preamble: false, emptySection: false });
    } else if (h && hasSlideLevel && h.level === S) {
      if (agendaIndex !== null && current.agenda === agendaIndex && current.slide === 0 && current.blocks.length === 0) {
        // Punktet har underoverskrifter og tom innledning: ingen lysbilde for innledningen (AR-2-05).
        groups.pop();
        perAgenda = 0;
      }
      const first = agendaIndex !== null && perAgenda === 0;
      open({
        key: slugger.slug(h.text),
        heading: h.text,
        agenda: agendaIndex,
        slide: agendaIndex !== null ? perAgenda++ : loose++,
        // Første lysbilde i punktet dekker også agendaoverskriften (start ved leseposisjon med `:agenda av`).
        sourceHeadingIds: first ? [agendaHeadingIds[agendaIndex as number] as string, h.id] : [h.id],
        preamble: false,
        emptySection: false,
      });
    } else {
      current.blocks.push(block);
    }
  }

  const drafts: SlideDraft[] = [
    { baseId: TITLE_SLIDE_ID, kind: 'title', address: { kind: 'title', agenda: null, slide: 0, part: 1 }, heading: source.title, continued: false, units: [], sourceHeadingIds: [], preamble: false },
  ];
  drafts.push(...partsOf(preamble));
  if (agenda.length > 0) {
    drafts.push({ baseId: AGENDA_SLIDE_ID, kind: 'agenda', address: { kind: 'agenda', agenda: null, slide: 0, part: 1 }, heading: null, continued: false, units: [], sourceHeadingIds: [], preamble: false });
  }
  for (const group of groups.slice(1)) {
    if (group.agenda !== null && group.slide === 0) {
      const item = agenda[group.agenda] as AgendaItem;
      drafts.push({
        baseId: transitionSlideId(item.key),
        kind: 'transition',
        address: { kind: 'transition', agenda: group.agenda, slide: 0, part: 1 },
        heading: null,
        continued: false,
        units: [],
        sourceHeadingIds: [agendaHeadingIds[group.agenda] as string],
        preamble: false,
      });
    }
    drafts.push(...partsOf(group));
  }
  return { title: source.title, agenda, agendaLevel: agenda.length > 0 ? A : null, slideLevel: S, validLevels, drafts };
};
