// v3 – terminalriggen og fasiten (docs/test/testplan-v3.md §2 og §3). KJØRER NÅ (ingen v3-funksjonalitet trengs):
// TC-3-00-* beviser at riggen (tmux-pty, skjermbuffer, råstrøm, stty, nettvakt) kan oppdage både riktig og feil
// oppførsel, så akseptansetestene ikke blir grønne av feil grunn. TC-3-02-00 sjekker v3-fasiten mot testvaultet og
// v2-fasiten; TC-3-02-00w sjekker det nye notatet `Terminalkanter` mot web-presentasjonen (v2 er fasitens kilde).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../support/real-server';
import { test as webTest } from '../support/guards';
import { lesAlleLysbilder, presenter, somFasit, type FasitLysbilde } from '../support/v2';
import {
  expect,
  fasit2Rå,
  fasit3,
  fasitNotat,
  FIGLET,
  figletBredde,
  figletKjede,
  STANDARDSTØRRELSER,
  tegnFiglet,
  finnFiglet,
  kontrast,
  test,
  tolkSgr,
  visningsbredde,
} from '../support/terminal';

const vent = (ms: number) => new Promise((r) => setTimeout(r, ms));

test.describe('TC-3-00 terminalriggen (tmux-pty)', () => {
  test('TC-3-00-01 ser alternativ skjerm, skjult markør, truecolor, bredde-2-tegn, resize og ren avslutning', async ({ rigg }) => {
    const app = String.raw`printf '\033[?1049h\033[?25l\033[2J\033[H\033[38;2;154;43;26;48;2;244;238;226mQA-RIGG æøå 🚀 漢字\033[0m'; sleep 1.2; printf '\033[?25h\033[?1049l'`;
    const t = await rigg({ kommando: app, størrelse: { cols: 80, rows: 24 } });
    await t.ventPåTekst('QA-RIGG');
    expect(t.tilstand()).toMatchObject({ alternativSkjerm: true, markørSynlig: false, bredde: 80, høyde: 24 });
    const rad = t.celler().find((r) => r.map((c) => c.tegn).join('').includes('QA-RIGG'))!;
    expect(rad[0]).toMatchObject({ tegn: 'Q', fg: { kind: 'rgb', hex: '#9a2b1a' }, bg: { kind: 'rgb', hex: '#f4eee2' } });
    expect(visningsbredde('QA-RIGG æøå 🚀 漢字')).toBe(19);
    await t.endreStørrelse({ cols: 79, rows: 23 });
    expect(t.tilstand()).toMatchObject({ bredde: 79, høyde: 23 });
    expect(await t.ventPåExit()).toBe(0);
    expect(t.tilstand()).toMatchObject({ alternativSkjerm: false, markørSynlig: true });
    expect(t.råstrøm()).toContain('\u001b[?1049h');
    expect(t.råstrøm()).toContain('\u001b[?1049l');
    expect(t.stty().etter).toBe(t.stty().før);
  });

  test('TC-3-00-02 oppdager en app som etterlater alternativ skjerm, skjult markør og rå modus', async ({ rigg }) => {
    const app = String.raw`printf '\033[?1049h\033[?25l'; stty raw -echo; sleep 0.3`;
    const t = await rigg({ kommando: app, størrelse: { cols: 80, rows: 24 } });
    await t.ventPåExit();
    expect(t.tilstand()).toMatchObject({ alternativSkjerm: true, markørSynlig: false });
    expect(t.stty().etter).not.toBe(t.stty().før);
  });

  test('TC-3-00-03 nettvakten logger TCP-forsøk (også loopback) fra Node-prosesser', async ({ rigg }) => {
    const app = `node -e "require('node:net').connect(9, '127.0.0.1').on('error', () => {})"; sleep 0.2`;
    const t = await rigg({ kommando: app });
    await t.ventPåExit();
    await vent(50);
    expect(t.nettforsøk()).toHaveLength(1);
    expect(JSON.parse(t.nettforsøk()[0]!)).toMatchObject({ host: '127.0.0.1', port: 9 });
  });

  test('TC-3-00-04 Ctrl c og tastenavn når appen (stty-ekko) – send-keys virker', async ({ rigg }) => {
    const app = String.raw`trap 'printf "\nQA-SIGINT\n"; exit 130' INT; printf 'klar\n'; read linje; printf 'LEST=%s\n' "$linje"; sleep 5`;
    const t = await rigg({ kommando: app });
    await t.ventPåTekst('klar');
    await t.skriv('æøå j');
    await t.trykk('Enter');
    await t.ventPåTekst('LEST=æøå j');
    await t.trykk('C-c');
    await t.ventPåTekst('QA-SIGINT');
    expect(await t.ventPåExit()).toBe(130);
  });

  test('TC-3-00-05 hjelperne: SGR-tolking, figlet-gjenkjenning, kontrast', () => {
    const celler = tolkSgr('\u001b[1;38;2;1;2;3mAB\u001b[0m C\n\u001b[38;5;208mX\u001b[39;7mY');
    expect(celler[0]![0]).toMatchObject({ tegn: 'A', fet: true, fg: { kind: 'rgb', hex: '#010203' } });
    expect(celler[0]![3]).toMatchObject({ tegn: 'C', fet: false, fg: { kind: 'standard' } });
    expect(celler[1]![0]).toMatchObject({ fg: { kind: '256', n: 208 } });
    expect(celler[1]![1]).toMatchObject({ invertert: true, fg: { kind: 'standard' } });
    const figlet = [' _   _      _ ', '| | | | ___(_)', '| |_| |/ _ \\ |', '|  _  |  __/ |', '|_| |_|\\___|_|'].join('\n');
    expect(finnFiglet(tolkSgr(figlet))).toHaveLength(1);
    const ramme = ['┌──────────┐', '│ R01K01   │', '├──────────┤', '│ R02K01   │', '└──────────┘'].join('\n');
    expect(finnFiglet(tolkSgr(ramme))).toEqual([]);
    // UX sine to fonter gjenkjennes, med og uten tekst rundt.
    for (const [navn, font] of Object.entries(FIGLET)) {
      const rader = ['  Statusmøte uke 45', '', ...tegnFiglet('Særtegn', font).map((r) => `  ${r}`), '', '  Neste: Blokker'];
      expect(finnFiglet(tolkSgr(rader.join('\n'))), navn).toEqual([expect.objectContaining({ fra: 2, til: 1 + font.hoyde })]);
    }
    expect(kontrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });
});

// ---------------------------------------------------------------------------------------------
// TC-3-02-00 fasiten mot testvaultet og v2-fasiten (ren logikk)
// ---------------------------------------------------------------------------------------------

test.describe('TC-3-02-00 v3-fasiten', () => {
  const f = fasit3 as unknown as {
    rekkefolge: { v2Notater: string[] };
    figlet: {
      typer: string[];
      lysbilder: Record<string, number[]>;
      hoder: ({ notat: string; lysbilde: number; type: string; tekst: string } & Record<string, unknown>)[];
    };
    nummerering: { lysbilder: Record<string, Record<string, string | null>> };
    plassholdere: { steder: { notat: string; lysbilde: number; type: string }[] };
  };

  test('Terminalkanter: overskrifter, agenda og markører finnes i notatet', () => {
    const kilde = readFileSync(join(REPO, 'test-vault', `${fasit3.kanter.sti}.md`), 'utf8');
    for (const p of fasit3.kanter.agenda ?? []) expect(kilde).toContain(`\n## ${p}\n`);
    for (const l of fasit3.kanter.lysbilder.filter((x) => x.type === 'innhold')) expect(kilde).toContain(`\n### ${l.overskrift}\n`);
    for (const m of fasit3.kanter.lysbilder.flatMap((l) => l.inneholder ?? []).filter((m) => m.startsWith('TERM-'))) expect(kilde).toContain(`Markør ${m}.`);
    // Kombinerende tegn må faktisk stå i NFD i kilden (ellers tester vi ingenting).
    expect(kilde).toContain('Ä');
  });

  test('alle v2-notater som gjenbrukes finnes i v2-fasiten, og figlet-lysbildene er nøyaktig T/A/O', () => {
    for (const n of f.rekkefolge.v2Notater) expect(fasit2Rå[n], n).toBeDefined();
    for (const [nøkkel, liste] of Object.entries(f.figlet.lysbilder)) {
      const forventet = fasitNotat(nøkkel).lysbilder.map((l, i) => (f.figlet.typer.includes(l.type) ? i + 1 : 0)).filter(Boolean);
      expect(liste, nøkkel).toEqual(forventet);
    }
  });

  test('figlet-hodene i fasiten stemmer med fallback-kjeden i ADR-011 §5 regnet med UX sine .flf-fonter', () => {
    for (const h of f.figlet.hoder) {
      const l = fasitNotat(h.notat).lysbilder[h.lysbilde - 1]!;
      expect(l.type, `${h.notat} ${h.lysbilde}`).toBe(h.type);
      expect(l.type === 'agenda' ? 'Agenda' : l.type === 'tittel' ? l.overskrift : l.agendapunkt).toBe(h.tekst);
      for (const s of STANDARDSTØRRELSER) {
        const nøkkel = `${s.cols}x${s.rows}`;
        expect(h[nøkkel], `${h.tekst} ved ${nøkkel}`).toEqual(figletKjede(h.tekst, s, h.type === 'tittel'));
      }
    }
    // Kanttilfellene som fasiten skal dekke: én linje, to linjer, smal font, fallback (bredde) og fallback (emoji).
    const valg = new Set(f.figlet.hoder.flatMap((h) => STANDARDSTØRRELSER.map((s) => h[`${s.cols}x${s.rows}`])).filter((v) => typeof v === 'object').map((v) => JSON.stringify(v)));
    for (const v of [{ font: 'blokk', linjer: 1 }, { font: 'blokk', linjer: 2 }, { font: 'smal', linjer: 1 }, { font: 'smal', linjer: 2 }, { font: 'fallback', linjer: 0 }]) expect(valg).toContain(JSON.stringify(v));
    expect(figletBredde('Særtegn 🙂', FIGLET.blokk), 'emoji mangler i fonten').toBeNull();
    expect(figletBredde('Del én', FIGLET.blokk), 'é → E').toBe(figletBredde('DEL EN', FIGLET.blokk));
  });

  test('nummereringen «0n /» følger agendapunktet, og plassholderne peker på riktige lysbilder', () => {
    for (const [nøkkel, nummer] of Object.entries(f.nummerering.lysbilder)) {
      const n = fasitNotat(nøkkel);
      for (const [i, pad] of Object.entries(nummer)) {
        const l = n.lysbilder[Number(i) - 1]!;
        expect(l.type).toBe('innhold');
        const idx = (n.agenda ?? []).indexOf(l.agendapunkt ?? '');
        expect(pad).toBe(idx >= 0 ? `${String(idx + 1).padStart(2, '0')} /` : null);
      }
    }
    const v2 = fasit2Rå as unknown as Record<string, { lysbilder: (FasitLysbilde & { base?: unknown })[] }>;
    for (const s of f.plassholdere.steder) {
      const l = s.notat === 'kanter' ? fasit3.kanter.lysbilder[s.lysbilde - 1]! : v2[s.notat]!.lysbilder[s.lysbilde - 1]!;
      expect(l.type, `${s.notat} ${s.lysbilde}`).toBe('innhold');
      if (s.type === 'mermaid') expect((l as FasitLysbilde).mermaid).toBe(true);
      if (s.type === 'kanban') expect((l as FasitLysbilde).base?.type).toBe('kanban');
    }
  });
});

// Kilden for rekkefølgen er v2: den nye fasiten for `Terminalkanter` må stemme med web-presentasjonen.
webTest.describe('TC-3-02-00w Terminalkanter i web-presentasjonen (v2) == v3-fasiten', () => {
  webTest('samme lysbilderekkefølge, typer, agendapunkter og progresjon', async ({ page }, testInfo) => {
    webTest.skip(testInfo.project.name !== 'terminal', 'kjøres i terminal-prosjektet');
    await presenter(page, fasit3.kanter.sti);
    const lest = await lesAlleLysbilder(page);
    expect(lest).toEqual(fasit3.kanter.lysbilder.map((l) => somFasit(l as FasitLysbilde)));
  });
});
