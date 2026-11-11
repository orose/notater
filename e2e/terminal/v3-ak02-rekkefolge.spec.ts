// AK-3-02 Lysbilderekkefølgen er identisk med v2 for alle notater i `test-vault/presentasjon/` (samme fasit,
// docs/test/v2-fasit.json). Testplan: TC-3-02-*. Fasit: v3-fasit.json › rekkefolge (+ kanter for det nye notatet).
//
// Lysbildet leses fra skjermen: nummer «n/N» i statuslinjen, overskrift og markører i innholdsflaten, progresjon i
// agendalinjen. Ved 200×50 skal lista være eksakt lik fasiten. Ved 80×24 og 120×36 kan et innholdslysbilde få ekstra
// «(forts.)»-deler (terminalen er mindre enn lerretet); de hoppes over i sammenligningen (Q-3-01).
import {
  agendalinje,
  expect,
  fasit3,
  fasitNotat,
  innholdsflate,
  lesAlleSkjermer,
  lysbildenummer,
  presenterNotat,
  skjøtt,
  test,
  Terminal,
  type Størrelse,
  type V3Lysbilde,
  type V3Notat,
} from '../support/terminal';

const r = fasit3 as unknown as {
  rekkefolge: { v2Notater: string[]; eksaktVed: Størrelse; moduloFortsVed: Størrelse[] };
  forts: { notat: string; storrelser: Størrelse[] };
};
const FORTS = ' (forts.)';
const MARKØR = /^[A-ZÆØÅ]+-[A-ZÆØÅ0-9-]+$/;

interface LestSkjerm {
  readonly rader: string[];
  readonly tekst: string;
  readonly n: number;
  readonly av: number;
}

async function lesNotat(t: Terminal): Promise<LestSkjerm[]> {
  return (await lesAlleSkjermer(t)).map((rader) => ({ rader, tekst: skjøtt(rader), ...lysbildenummer(rader)! }));
}

/** Grov gjenkjenning: er skjermen fasitlysbildet `l`? Brukes bare for å hoppe over ekstra «(forts.)» (Q-3-01). */
function passer(s: LestSkjerm, l: V3Lysbilde): boolean {
  const markør = (l.inneholder ?? []).find((x) => MARKØR.test(x));
  if (markør) return s.tekst.includes(markør);
  if (l.type === 'innhold' && l.overskrift) return s.tekst.includes(l.overskrift);
  return true;
}

const grunnOverskrift = (l: V3Lysbilde | undefined): string | null => (l?.type === 'innhold' && l.overskrift ? l.overskrift.replace(FORTS, '') : null);

/** Sjekker ett lest lysbilde mot fasiten. */
function forventSomFasit(s: LestSkjerm, l: V3Lysbilde, notat: V3Notat, hvor: string, medProgresjon: boolean): void {
  const agenda = notat.agenda ?? [];
  const linje = agendalinje(s.rader, agenda);
  switch (l.type) {
    case 'tittel':
      expect(s.tekst, `${hvor}: tittel`).toContain(l.overskrift!);
      expect(linje, `${hvor}: ingen agendalinje på tittellysbildet`).toBeNull();
      break;
    case 'agenda':
      for (const p of agenda.slice(0, 3)) expect(s.tekst, `${hvor}: agendapunkt ${p}`).toContain(p.slice(0, 20));
      break;
    case 'overgang':
      expect(s.tekst, `${hvor}: overgang til ${l.agendapunkt}`).toContain(l.agendapunkt!.slice(0, 20));
      break;
    default: {
      const flate = skjøtt(innholdsflate(s.rader, agenda));
      if (l.overskrift) expect(flate, `${hvor}: overskrift`).toContain(l.overskrift);
      // Ekstra «(forts.)» endrer progresjonen (den teller delene, Q-02), så den sammenlignes bare i eksakt modus.
      if (l.progresjon && medProgresjon) expect(linje ?? '', `${hvor}: progresjon i agendalinjen`).toContain(l.progresjon);
      if (l.progresjon && !medProgresjon) expect(linje ?? '', `${hvor}: progresjon n/m i agendalinjen`).toMatch(/\d+\/\d+/);
      if (!l.agendapunkt) expect(linje, `${hvor}: ingen agendalinje uten agendapunkt`).toBeNull();
      for (const m of (l.inneholder ?? []).filter((x) => MARKØR.test(x))) expect(flate, `${hvor}: markør ${m}`).toContain(m);
    }
  }
}

function sammenlign(lest: LestSkjerm[], notat: V3Notat, eksakt: boolean, navn: string): void {
  if (eksakt) expect(lest[0]?.av, `${navn}: antall lysbilder`).toBe(notat.lysbilder.length);
  let i = 0;
  for (const s of lest) {
    const l = notat.lysbilder[i];
    const forrige = grunnOverskrift(notat.lysbilder[i - 1]);
    if (!eksakt && forrige && s.tekst.includes(`${forrige}${FORTS}`) && (!l || !passer(s, l))) continue;
    expect(l, `${navn}: flere lysbilder i terminalen enn i fasiten (lysbilde ${s.n})`).toBeDefined();
    forventSomFasit(s, l!, notat, `${navn} ${s.n}/${s.av}`, eksakt);
    i++;
  }
  expect(i, `${navn}: alle fasitlysbildene ble vist`).toBe(notat.lysbilder.length);
}

const NOTATER = [...r.rekkefolge.v2Notater.filter((n) => n !== 'mye'), 'kanter'];

test.describe('AK-3-02 lysbilderekkefølgen er identisk med v2', () => {
  for (const nøkkel of NOTATER) {
    const notat = fasitNotat(nøkkel);
    test.fixme(`TC-3-02-01 ${notat.sti} ved 200×50 er eksakt lik fasiten`, async ({ present }) => {
      const t = await presenterNotat(present, notat.sti, { størrelse: r.rekkefolge.eksaktVed });
      sammenlign(await lesNotat(t), notat, true, nøkkel);
    });
    for (const s of r.rekkefolge.moduloFortsVed) {
      test.fixme(`TC-3-02-02 ${notat.sti} ved ${s.cols}×${s.rows} er lik fasiten når ekstra «(forts.)» hoppes over`, async ({ present }) => {
        const t = await presenterNotat(present, notat.sti, { størrelse: s });
        sammenlign(await lesNotat(t), notat, false, nøkkel);
      });
    }
  }

  for (const [flagg, nivå] of [
    ['h4', 'h4'],
    ['h2', 'h2'],
  ] as const) {
    test.fixme(`TC-3-02-03 --niva ${flagg} gir v2-rekkefølgen for Lysbildenivå (${nivå})`, async ({ present }) => {
      const niva = fasitNotat('niva') as unknown as Record<string, V3Notat> & { sti: string };
      const t = await presenterNotat(present, niva.sti, { størrelse: r.rekkefolge.eksaktVed, args: ['--niva', flagg] });
      sammenlign(await lesNotat(t), { ...niva[nivå]!, sti: niva.sti }, true, `niva ${flagg}`);
    });
  }

  test.fixme('TC-3-02-04 «Mye innhold»: alle markører nøyaktig én gang, i rekkefølge, ved 80×24 og 200×50', async ({ present }) => {
    const mye = fasitNotat('mye') as unknown as { sti: string; markorer: string[]; minstDeler: number; overskrift: string };
    for (const s of r.forts.storrelser) {
      const t = await presenterNotat(present, mye.sti, { størrelse: s });
      const tekst = (await lesNotat(t)).map((x) => x.tekst).join(' ');
      const posisjoner = mye.markorer.map((m) => [...tekst.matchAll(new RegExp(`${m}(?![0-9])`, 'g'))].map((x) => x.index!));
      posisjoner.forEach((p, i) => expect(p, `${mye.markorer[i]} ved ${s.cols}×${s.rows}`).toHaveLength(1));
      const flat = posisjoner.map((p) => p[0]!);
      expect(flat, 'rekkefølge').toEqual([...flat].sort((a, b) => a - b));
      expect(tekst.split(`${mye.overskrift}${FORTS}`).length - 1, '«(forts.)»-deler').toBeGreaterThanOrEqual(mye.minstDeler - 1);
    }
  });

  test.fixme('TC-3-02-05 --uten-agenda: overgangene er borte, resten i samme rekkefølge (QA-V2-23)', async ({ present }) => {
    const notat = fasitNotat('statusmote');
    const t = await presenterNotat(present, notat.sti, { størrelse: r.rekkefolge.eksaktVed, args: ['--uten-agenda'] });
    sammenlign(await lesNotat(t), { ...notat, lysbilder: notat.lysbilder.filter((l) => l.type !== 'overgang') }, true, 'uten agenda');
  });

  test.fixme('TC-3-02-06 «Månedsrapport oktober»: seksjonen «Utenfor rapporten» vises aldri', async ({ present }) => {
    const rapport = fasitNotat('rapport') as V3Notat & { aldriSynlig: string[] };
    const t = await presenterNotat(present, rapport.sti, { størrelse: { cols: 80, rows: 24 } });
    const tekst = (await lesNotat(t)).map((x) => x.tekst).join(' ');
    for (const m of rapport.aldriSynlig) expect(tekst).not.toContain(m);
  });
});
