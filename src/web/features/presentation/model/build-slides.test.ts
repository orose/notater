// Lysbildemodellen mot QAs fasit (docs/test/v2-fasit.json, AK-2-02/03/04/05). Inndata er serverens ekte HAST for
// test-vault/presentasjon/ (fixtures/*.json, hentet med `GET /api/vaults/test/document`; regenereres med
// `npx tsx scripts/presentation-fixtures.ts` når testvaultet endres).
import type { Root } from 'hast';
import { describe, expect, it } from 'vitest';
import type { TocEntry } from '../../../../shared/api-types';
import { buildOutline } from '../../outline';
import { prepareContent, splitLeadingTitle } from '../../note-view';
import { buildSlideDrafts, fromOutline } from './build-slides';
import { finalizeDeck } from './finalize-deck';
import type { DeckFit, FlowBlock, HeadingLevel, Slide, SlideDeck, SlideDraftDeck } from './slide-types';
import fasitJson from '../../../../../docs/test/v2-fasit.json';

interface FasitSlide {
  readonly type: string;
  readonly overskrift: string | null;
  readonly agendapunkt?: string | null;
  readonly progresjon?: string | null;
  readonly inneholder?: readonly string[];
}
interface FasitNote {
  readonly sti: string;
  readonly agenda?: readonly string[];
  readonly lysbilder: readonly FasitSlide[];
  readonly urlIder?: Readonly<Record<string, number>>;
}

const fasit = fasitJson as unknown as Record<string, unknown> & {
  readonly statusmote: FasitNote & { readonly startFraSeksjon: Record<string, number> };
  readonly rapport: FasitNote & { readonly aldriSynlig: readonly string[] };
  readonly delte: FasitNote;
  readonly stor: FasitNote;
  readonly uten: FasitNote;
  readonly forKort: FasitNote;
  readonly forLang: FasitNote;
  readonly mange: FasitNote;
  readonly niva: { readonly sti: string } & Record<'h2' | 'h3' | 'h4', { readonly agenda: readonly string[]; readonly lysbilder: readonly FasitSlide[] }>;
};

interface Fixture {
  readonly title: string;
  readonly content: Root;
  readonly toc: readonly TocEntry[];
}

const FIXTURES = import.meta.glob<Fixture>('./fixtures/*.json', { eager: true, import: 'default' });

function load(sti: string): Fixture {
  const fixture = FIXTURES[`./fixtures/${sti.replace(/^presentasjon\//, '')}.json`];
  if (!fixture) throw new Error(`Mangler fixture for ${sti}`);
  return fixture;
}

function drafts(sti: string, slideLevel: HeadingLevel | null = null): SlideDraftDeck {
  const doc = load(sti);
  const display = splitLeadingTitle(doc);
  const outline = buildOutline(prepareContent(display.content), display.toc, true);
  return buildSlideDrafts(fromOutline(outline, display.title), { slideLevel });
}

const NO_FIT: DeckFit = { drafts: {}, compactAgendaLine: false, complete: true };
const KIND: Record<Slide['kind'], string> = { title: 'tittel', agenda: 'agenda', transition: 'overgang', content: 'innhold' };

/** Samme projeksjon som `somFasit` i e2e/support/v2.ts. */
function project(deck: SlideDeck): FasitSlide[] {
  return deck.slides.map((s) => {
    const agendapunkt = s.agendaIndex === null ? null : (deck.agenda[s.agendaIndex]?.text ?? null);
    switch (s.kind) {
      case 'title':
        return { type: 'tittel', overskrift: s.heading, agendapunkt: null, progresjon: null };
      case 'agenda':
        return { type: 'agenda', overskrift: null, agendapunkt: null, progresjon: null };
      case 'transition':
        return { type: 'overgang', overskrift: null, agendapunkt, progresjon: null };
      default:
        return {
          type: KIND[s.kind],
          overskrift: s.heading,
          agendapunkt: s.heading === null ? null : agendapunkt,
          progresjon: s.heading === null || !s.progress ? null : `${s.progress.index}/${s.progress.count}`,
        };
    }
  });
}

function expected(slides: readonly FasitSlide[]): FasitSlide[] {
  return slides.map((l) => {
    if (l.type === 'tittel') return { type: 'tittel', overskrift: l.overskrift, agendapunkt: null, progresjon: null };
    if (l.type === 'agenda') return { type: 'agenda', overskrift: null, agendapunkt: null, progresjon: null };
    if (l.type === 'overgang') return { type: 'overgang', overskrift: null, agendapunkt: l.agendapunkt ?? null, progresjon: null };
    return { type: 'innhold', overskrift: l.overskrift, agendapunkt: l.agendapunkt ?? null, progresjon: l.progresjon ?? null };
  });
}

/** Tekst i et lysbilde (enheter + overskrift), til markørsjekk. */
function text(slide: Slide): string {
  const walk = (n: unknown): string => {
    const node = n as { type: string; value?: string; children?: unknown[]; properties?: Record<string, unknown> };
    if (node.type === 'text') return node.value ?? '';
    const code = typeof node.properties?.dataCode === 'string' ? node.properties.dataCode : '';
    return code + (node.children ?? []).map(walk).join(' ');
  };
  return `${slide.heading ?? ''} ${slide.units.map((u) => walk(u.node)).join(' ')}`;
}

describe('buildSlideDrafts + finalizeDeck mot fasiten (S1–S8)', () => {
  const cases: Array<[string, FasitNote, DeckFit]> = [
    ['statusmøtet', fasit.statusmote, NO_FIT],
    ['rapport av diskré embeds (S1)', fasit.rapport, NO_FIT],
    ['delinger med --- og *** (S5)', fasit.delte, NO_FIT],
    ['store enkeltblokker', fasit.stor, NO_FIT],
    ['uten overskrifter (S7)', fasit.uten, NO_FIT],
    ['kort innhold før agenda (S6, på tittellysbildet)', fasit.forKort, { ...NO_FIT, drafts: { innledning: { scale: 1, breaks: [], scrollUnits: [], onTitle: true } } }],
    ['langt innhold før agenda (S6, eget lysbilde)', fasit.forLang, NO_FIT],
    ['8 agendapunkter', fasit.mange, NO_FIT],
  ];
  for (const [name, note, fit] of cases) {
    it(name, () => {
      const deck = finalizeDeck(drafts(note.sti), fit, { transitions: true });
      expect(project(deck)).toEqual(expected(note.lysbilder));
      // Tittellysbildets ingress og egenskaper kommer fra dokumentet, ikke modellen (testes i e2e).
      deck.slides.forEach((s, i) => {
        if (s.kind === 'title' && !s.withPreamble) return;
        for (const m of (note.lysbilder[i]?.inneholder ?? []).filter((x) => s.kind !== 'title' || !x.startsWith('Ingress'))) expect(text(s), `#${i + 1} ${m}`).toContain(m);
        if (s.kind !== 'title') for (const m of note.lysbilder[i]?.inneholder ?? []) expect(text(s), `#${i + 1} ${m}`).toContain(m);
      });
    });
  }

  it('rapport: seksjonsembed tar bare seksjonen', () => {
    const deck = finalizeDeck(drafts(fasit.rapport.sti), NO_FIT, { transitions: true });
    for (const s of deck.slides) for (const m of fasit.rapport.aldriSynlig) expect(text(s)).not.toContain(m);
  });

  for (const level of ['h2', 'h3', 'h4'] as const) {
    it(`:presenter ${level} (S4, AR-2-03/04)`, () => {
      const deck = finalizeDeck(drafts(fasit.niva.sti, Number(level.slice(1)) as HeadingLevel), NO_FIT, { transitions: true });
      expect(deck.agenda.map((a) => a.text)).toEqual(fasit.niva[level].agenda);
      expect(project(deck)).toEqual(expected(fasit.niva[level].lysbilder));
    });
  }

  it('automatisk nivå = h3 i «Lysbildenivå»; gyldige nivåer er nivåene som finnes', () => {
    const d = drafts(fasit.niva.sti);
    expect([d.agendaLevel, d.slideLevel]).toEqual([2, 3]);
    expect(d.validLevels).toEqual([2, 3, 4]);
    expect(project(finalizeDeck(d, NO_FIT, { transitions: true }))).toEqual(expected(fasit.niva.h3.lysbilder));
  });

  it('S7: ingen overskrifter gir ingen gyldige nivåer og ingen agenda', () => {
    const d = drafts(fasit.uten.sti);
    expect(d.validLevels).toEqual([]);
    expect(d.agenda).toEqual([]);
  });
});

describe('id-er (ADR-010 §4, AR-2-14)', () => {
  for (const note of [fasit.statusmote, fasit.delte]) {
    it(note.sti, () => {
      const deck = finalizeDeck(drafts(note.sti), NO_FIT, { transitions: true });
      for (const [id, nr] of Object.entries(note.urlIder ?? {})) expect(deck.slides[nr - 1]?.id, id).toBe(id);
      expect(new Set(deck.slides.map((s) => s.id)).size).toBe(deck.slides.length);
    });
  }

  it('agendapunktets eget lysbilde bruker agendanøkkelen (rapport «Jobbes med nå»)', () => {
    const deck = finalizeDeck(drafts(fasit.rapport.sti), NO_FIT, { transitions: true });
    expect(deck.slides.map((s) => s.id)).toContain('overgang.jobbes-med-nå');
    expect(deck.slides.map((s) => s.id)).toContain('jobbes-med-nå');
  });
});

describe('finalizeDeck (A2, :agenda av, progresjon, etiketter)', () => {
  const d = drafts(fasit.statusmote.sti);

  it(':agenda av fjerner overgangene, agendalysbildet blir', () => {
    const deck = finalizeDeck(d, NO_FIT, { transitions: false });
    expect(project(deck)).toEqual(expected(fasit.statusmote.lysbilder.filter((l) => l.type !== 'overgang')));
  });

  it('A2-brudd gir «(forts.)»-lysbilder med samme skala, og progresjonen teller dem', () => {
    const base = d.drafts.find((x) => x.baseId === 'leveranse-a--lesekomfort')!;
    expect(base.units.length).toBeGreaterThan(2);
    const deck = finalizeDeck(d, { ...NO_FIT, drafts: { [base.baseId]: { scale: 0.8, breaks: [2], scrollUnits: [] } } }, { transitions: true });
    const [a, b] = deck.slides.filter((s) => s.id.startsWith('leveranse-a'));
    expect(a?.id).toBe('leveranse-a--lesekomfort');
    expect(b?.id).toBe('leveranse-a--lesekomfort.forts2');
    expect(b?.heading).toBe('Leveranse A – lesekomfort (forts.)');
    expect([a?.scale, b?.scale]).toEqual([0.8, 0.8]);
    expect([a?.progress, b?.progress]).toEqual([{ index: 1, count: 3 }, { index: 2, count: 3 }]);
    expect(deck.slides).toHaveLength(fasit.statusmote.lysbilder.length + 1);
    expect(a!.units.length + b!.units.length).toBe(base.units.length);
  });

  it('lister deles i listepunkter med felles listKey (aldri inne i ett punkt, AR-2-06)', () => {
    const base = d.drafts.find((x) => x.baseId === 'leveranse-a--lesekomfort')!;
    const items = base.units.filter((u) => u.listKey !== null);
    expect(items).toHaveLength(3);
    expect(new Set(items.map((u) => u.listKey)).size).toBe(1);
    expect(items.every((u) => u.node.type === 'element' && u.node.tagName === 'li')).toBe(true);
  });

  it('id-er er fjernet fra innholdet; overflow per blokktype', () => {
    const deck = finalizeDeck(d, NO_FIT, { transitions: true });
    const json = JSON.stringify(deck.slides.map((s) => s.units));
    expect(json).not.toMatch(/"id":/);
    const overflow = (id: string) => deck.slides.find((s) => s.id === id)?.units.map((u) => u.overflow);
    expect(overflow('leveranse-b--tastaturmotor')).toEqual(['flow', 'scroll', 'flow']);
    expect(overflow('flyt-i-presentasjonen')).toEqual(['scale', 'flow']);
    expect(overflow('oppgaver')).toEqual(['flow', 'scroll']);
  });

  it('fotnoter (A4) samles på lysbildet med referansen', () => {
    const deck = finalizeDeck(d, NO_FIT, { transitions: true });
    const plan = deck.slides.find((s) => s.id === 'plan-q1')!;
    expect(plan.footnotes.map((f) => f.number)).toEqual(['1']);
    expect(JSON.stringify(plan.footnotes[0]?.content)).toContain('Avhenger av kapasitet i plattformteamet.');
    expect(deck.slides.filter((s) => s.footnotes.length > 0)).toHaveLength(1);
  });

  it('nummer og etiketter (skjermleser)', () => {
    const deck = finalizeDeck(d, NO_FIT, { transitions: true });
    expect(deck.slides.map((s) => s.number)).toEqual(deck.slides.map((_, i) => i + 1));
    expect(deck.slides[4]?.label).toBe('Lysbilde 5 av 10: Leveranse B – tastaturmotor');
    expect(deck.slides[0]?.label).toBe('Lysbilde 1 av 10: Statusmøte uke 45');
    expect(deck.slides[5]?.label).toBe('Lysbilde 6 av 10: Agenda: Jobbes med nå');
  });

  it('kilde-overskrifter: start ved leseposisjon', () => {
    const deck = finalizeDeck(d, NO_FIT, { transitions: true });
    const first = (id: string) => deck.slides.findIndex((s) => s.sourceHeadingIds.includes(id)) + 1;
    expect(first('oppgaver')).toBe(7);
    expect(first('jobbes-med-nå')).toBe(6);
    expect(first('plan-q1')).toBe(10);
    const off = finalizeDeck(d, NO_FIT, { transitions: false });
    expect(off.slides.findIndex((s) => s.sourceHeadingIds.includes('jobbes-med-nå')) + 1).toBe(5);
  });

  it('tom agendaseksjon: bare overgangen, med :agenda av et lysbilde med kun overskriften', () => {
    const flow: FlowBlock[] = [
      { node: { type: 'element', tagName: 'h2', properties: {}, children: [] }, heading: { id: 'a', level: 2, text: 'A' }, thematicBreak: false },
      { node: { type: 'element', tagName: 'h2', properties: {}, children: [] }, heading: { id: 'b', level: 2, text: 'B' }, thematicBreak: false },
      { node: { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: 'x' }] }, heading: null, thematicBreak: false },
    ];
    const src = { title: 'T', flow };
    const dd = buildSlideDrafts(src, { slideLevel: null });
    expect(finalizeDeck(dd, NO_FIT, { transitions: true }).slides.map((s) => s.id)).toEqual(['tittel', 'agenda', 'overgang.a', 'overgang.b', 'b']);
    expect(finalizeDeck(dd, NO_FIT, { transitions: false }).slides.map((s) => [s.id, s.heading])).toEqual([['tittel', 'T'], ['agenda', null], ['a', 'A'], ['b', 'B']]);
  });
});

describe('agendahjelpere', () => {
  it('delpunkter, startnummer, start ved overskrift og tilbake til overskrift', async () => {
    const { agendaSubtitles, agendaStartNumbers, headingForSlide, slideForHeading } = await import('./agenda');
    const d = drafts(fasit.rapport.sti);
    expect(agendaSubtitles(d)).toEqual([['Driftsstabilitet', 'Leveranser'], ['Ytelse', 'Presentasjonsmodus'], ['Milepæler', 'Risiko og tiltak']]);
    const deck = finalizeDeck(d, NO_FIT, { transitions: true });
    expect(agendaStartNumbers(deck)).toEqual([3, 6, 10]);
    expect(slideForHeading(deck, null)).toBe(0);
    expect(slideForHeading(deck, 'finnes-ikke')).toBe(0);
    const s = finalizeDeck(drafts(fasit.statusmote.sti), NO_FIT, { transitions: true });
    expect(headingForSlide(s, 9)).toBe('plan-q1');
    expect(headingForSlide(s, 0)).toBeNull();
    expect(headingForSlide(s, 4, (id) => id !== 'leveranse-b--tastaturmotor')).toBe('leveranse-a--lesekomfort');
  });
});
