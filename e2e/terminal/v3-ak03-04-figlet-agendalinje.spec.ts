// AK-3-03 Figlet-hode i aksentfarge på tittel/agenda/overgang; fallback når bredden ikke rekker; ikke på innholdslysbilder.
// AK-3-04 Agendalinjen vises på alle innholdslysbilder med riktig utheving og progresjon, og avkortes ved plassmangel.
// Testplan: TC-3-03-*, TC-3-04-*. Fasit: v3-fasit.json › figlet, agendalinje, nummerering; UX: docs/design/terminal/.
import {
  agendalinje,
  cellerFor,
  expect,
  fargeNøkkel,
  fargeroller,
  fasit3,
  fasitNotat,
  finnFiglet,
  gåTilLysbilde,
  lesAlleSkjermer,
  lysbildenummer,
  presenterNotat,
  skjøtt,
  STANDARDSTØRRELSER,
  test,
  visningsbredde,
  type Celle,
  type FigletValg,
  type Størrelse,
} from '../support/terminal';

const f = fasit3 as unknown as {
  figlet: {
    lysbilder: Record<string, number[]>;
    hoyde: Record<'blokk' | 'smal', number>;
    hoder: ({ notat: string; lysbilde: number; type: string; tekst: string } & Record<string, FigletValg | 'avhengerAvMarg'>)[];
  };
  agendalinje: { ellipse: string; vedBredde: Record<string, Record<string, Record<string, AgendaForventning>>> };
  nummerering: { lysbilder: Record<string, Record<string, string | null>> };
};
interface AgendaForventning {
  readonly synlige?: string[];
  readonly gjeldendeHel?: string;
  readonly gjeldendeForkortet?: boolean;
  readonly forkortet?: boolean;
  readonly før?: boolean;
  readonly etter?: boolean;
  readonly progresjon?: string;
}
const STØRRELSE: Record<'80' | '200', Størrelse> = { '80': { cols: 80, rows: 24 }, '200': { cols: 200, rows: 50 } };
const PALETT = fargeroller.standard.palett;
const hodeFarger = (palett: string): Set<string> =>
  new Set((['light', 'dark'] as const).flatMap((m) => [fargeroller.truecolor[palett]![m].roller.hode!, fargeroller.truecolor[palett]![m].roller.hode_skygge!]));

test.describe('AK-3-03 figlet-hode', () => {
  for (const h of f.figlet.hoder) {
    for (const s of STANDARDSTØRRELSER) {
      const forventet = h[`${s.cols}x${s.rows}`]!;
      const navn = typeof forventet === 'string' ? 'figlet eller fallback' : forventet.font === 'fallback' ? 'fallback' : `${forventet.font} × ${forventet.linjer}`;
      test.fixme(`TC-3-03-01 ${h.notat} ${h.lysbilde} «${h.tekst.slice(0, 24)}» ved ${s.cols}×${s.rows}: ${navn}`, async ({ present }) => {
        const t = await presenterNotat(present, fasitNotat(h.notat).sti, { størrelse: s, args: ['--palett', PALETT] });
        await gåTilLysbilde(t, h.lysbilde);
        const celler = t.celler();
        const blokker = finnFiglet(celler);
        const rader = blokker.reduce((sum, b) => sum + b.til - b.fra + 1, 0);
        if (typeof forventet !== 'string' && forventet.font === 'fallback') {
          expect(blokker, 'ingen figlet-blokk').toEqual([]);
          const tekst = cellerFor(celler, h.tekst.slice(0, 12)) ?? [];
          expect(tekst.length, 'teksten står som vanlig tekst').toBeGreaterThan(0);
          expect(tekst.every((c) => c.fet), 'fallback er fet (ADR-011 §5)').toBe(true);
          // Ingenting kuttes: hele teksten finnes når radene skjøtes (også et 80 tegn langt ord ved 80 kolonner).
          expect(t.skjerm().map((r) => r.trim()).join('').replace(/\s/g, '')).toContain(h.tekst.replace(/\s/g, ''));
        } else if (typeof forventet !== 'string') {
          const høyde = f.figlet.hoyde[forventet.font as 'blokk' | 'smal'];
          expect(rader, `${forventet.linjer} linje(r) i ${forventet.font}`).toBe(forventet.linjer * høyde);
          const lov = hodeFarger(PALETT);
          for (const b of blokker) for (const farge of b.farger) expect(lov, `figlet-farge ${farge} er rollen hode/hode_skygge`).toContain(farge);
        } else {
          expect(rader % f.figlet.hoyde.blokk === 0 || rader % f.figlet.hoyde.smal === 0 || (cellerFor(celler, h.tekst.slice(0, 12)) ?? []).every((c) => c.fet)).toBe(true);
        }
        // Høyde ≤ ⅓ av radene.
        expect(rader).toBeLessThanOrEqual(s.rows / 3);
      });
    }
  }

  for (const nøkkel of ['statusmote', 'kanter', 'mange']) {
    for (const s of [STØRRELSE['80'], STØRRELSE['200']]) {
      test.fixme(`TC-3-03-02 ${nøkkel} ved ${s.cols}×${s.rows}: figlet på nøyaktig T/A/O, aldri på innhold`, async ({ present }) => {
        const t = await presenterNotat(present, fasitNotat(nøkkel).sti, { størrelse: s });
        const skjermer = await lesAlleSkjermer(t);
        const forventet = new Set(f.figlet.lysbilder[nøkkel]);
        // lesAlleSkjermer gir bare tekst; les cellene på nytt per lysbilde for figlet.
        for (let i = 0; i < skjermer.length; i++) {
          await gåTilLysbilde(t, i + 1);
          const har = finnFiglet(t.celler()).length > 0;
          const typen = fasitNotat(nøkkel).lysbilder[i]?.type;
          if (typen === 'innhold') expect(har, `lysbilde ${i + 1} (innhold) har ikke figlet`).toBe(false);
          if (forventet.has(i + 1) && har === false) {
            // Fallback er lov der fonten ikke rekker, men da står teksten fet.
            expect(t.celler().some((r) => r.some((c: Celle) => c.fet)), `lysbilde ${i + 1}: figlet eller fet fallback`).toBe(true);
          }
        }
      });
    }
  }

  test.fixme('TC-3-03-03 resize fra 200×50 til 80×24 på overgangen «Kundetilbakemeldinger og support»: blokk → fet fallback, samme lysbilde', async ({ present }) => {
    const t = await presenterNotat(present, fasitNotat('mange').sti, { størrelse: STØRRELSE['200'] });
    await gåTilLysbilde(t, 13);
    expect(finnFiglet(t.celler()).map((b) => b.til - b.fra + 1)).toEqual([f.figlet.hoyde.blokk]);
    await t.endreStørrelse(STØRRELSE['80']);
    await expect.poll(() => finnFiglet(t.celler())).toEqual([]);
    expect(lysbildenummer(t.skjerm())?.n).toBe(13);
  });
});

test.describe('AK-3-04 agendalinjen', () => {
  for (const [bredde, notater] of Object.entries(f.agendalinje.vedBredde)) {
    const s = STØRRELSE[bredde as '80' | '200'];
    for (const [nøkkel, forventninger] of Object.entries(notater)) {
      if (nøkkel === 'mange' && bredde === '200') continue; // dekkes av TC-3-04-03
      test.fixme(`TC-3-04-01 ${nøkkel} ved ${bredde} kolonner: synlige punkter, utheving, progresjon, avkorting`, async ({ present }) => {
        const notat = fasitNotat(nøkkel);
        const agenda = notat.agenda ?? [];
        const t = await presenterNotat(present, notat.sti, { størrelse: s });
        const skjermer = await lesAlleSkjermer(t);
        // Tittel og agenda (lysbilde 1 og 2) har aldri agendalinje.
        for (const i of [0, 1]) if (notat.lysbilder[i]?.type !== 'innhold') expect(agendalinje(skjermer[i]!, agenda), `lysbilde ${i + 1}`).toBeNull();
        for (const l of notat.lysbilder.filter((x) => x.type === 'innhold' && x.overskrift && x.agendapunkt)) {
          // Første skjerm med overskriften (ekstra «(forts.)» ved 80×24 forskyver nummereringen).
          const rader = skjermer.find((r) => skjøtt(r.slice(1)).includes(l.overskrift!));
          expect(rader, `fant «${l.overskrift}»`).toBeDefined();
          const linje = agendalinje(rader!, agenda);
          expect(linje, `«${l.overskrift}» har agendalinje`).not.toBeNull();
          expect(visningsbredde(linje!), 'agendalinjen er ikke bredere enn terminalen').toBeLessThanOrEqual(s.cols);
          expect(linje, 'progresjon n/m').toMatch(/\d+\/\d+/);
          if (bredde === '200') expect(linje).toContain(l.progresjon!);
          const e = forventninger.alleLysbilder ?? forventninger[l.overskrift!];
          if (!e) continue;
          for (const p of e.synlige ?? []) expect(linje, `synlig: ${p}`).toContain(p);
          if (e.gjeldendeHel) expect(linje).toContain(e.gjeldendeHel);
          if (e.forkortet || e.gjeldendeForkortet) expect(linje).toContain(f.agendalinje.ellipse);
          if (e.før !== undefined) expect(linje!.trimStart().startsWith(f.agendalinje.ellipse), 'ellipse før').toBe(e.før);
          if (e.etter !== undefined) expect(linje!.trimEnd().endsWith(f.agendalinje.ellipse), 'ellipse etter').toBe(e.etter);
        }
        // Overgangene: agendalinjen er skjult (TC-3-04-05 sjekker hver overgang ved nummer i eksakt størrelse).
      });
    }
  }

  test.fixme('TC-3-04-02 gjeldende punkt er uthevet (andre attributter enn naboene) i statusmøtet', async ({ present }) => {
    const notat = fasitNotat('statusmote');
    const t = await presenterNotat(present, notat.sti, { størrelse: STØRRELSE['80'] });
    for (const n of [4, 7, 10]) {
      await gåTilLysbilde(t, n);
      const gjeldende = notat.lysbilder[n - 1]!.agendapunkt!;
      const andre = notat.agenda!.filter((p) => p !== gjeldende);
      const stil = (tekst: string) => {
        const c = cellerFor(t.celler().slice(0, 2), tekst)![0]!;
        return JSON.stringify([fargeNøkkel(c.fg), fargeNøkkel(c.bg), c.fet, c.invertert, c.understrek, c.dempet]);
      };
      for (const p of andre) expect(stil(gjeldende), `${gjeldende} skiller seg fra ${p}`).not.toBe(stil(p));
    }
  });

  test.fixme('TC-3-04-03 «Mange agendapunkter» ved 200 kolonner: forrige · nåværende · neste som i v2 (QA-V2-22)', async ({ present }) => {
    const mange = fasitNotat('mange') as unknown as { sti: string; agenda: string[]; avkortet: Record<string, { synlige: string[]; før: boolean; etter: boolean }> };
    const t = await presenterNotat(present, mange.sti, { størrelse: STØRRELSE['200'] });
    const skjermer = await lesAlleSkjermer(t);
    for (const [overskrift, e] of Object.entries(mange.avkortet)) {
      const rader = skjermer.find((r) => skjøtt(r).includes(overskrift))!;
      const linje = agendalinje(rader, mange.agenda)!;
      for (const p of e.synlige) expect(linje).toContain(p);
      for (const p of mange.agenda.filter((x) => !e.synlige.includes(x))) expect(linje).not.toContain(p);
    }
  });

  test.fixme('TC-3-04-05 ingen agendalinje på overgangene (200×50, eksakt nummerering)', async ({ present }) => {
    for (const nøkkel of ['statusmote', 'kanter', 'mange']) {
      const notat = fasitNotat(nøkkel);
      const t = await presenterNotat(present, notat.sti, { størrelse: STØRRELSE['200'] });
      for (const [i, l] of notat.lysbilder.entries()) {
        if (l.type !== 'overgang') continue;
        expect(agendalinje(await gåTilLysbilde(t, i + 1), notat.agenda ?? []), `${nøkkel} ${i + 1}`).toBeNull();
      }
    }
  });

  test.fixme('TC-3-04-04 innholdsoverskriften har agendanummeret «0n /»', async ({ present }) => {
    for (const nøkkel of ['statusmote', 'kanter']) {
      const t = await presenterNotat(present, fasitNotat(nøkkel).sti, { størrelse: STØRRELSE['80'] });
      for (const [n, nr] of Object.entries(f.nummerering.lysbilder[nøkkel]!)) {
        const rader = await gåTilLysbilde(t, Number(n));
        const overskrift = fasitNotat(nøkkel).lysbilder[Number(n) - 1]!.overskrift!;
        const rad = rader.find((r) => r.includes(overskrift.slice(0, 12))) ?? '';
        if (nr) expect(skjøtt(rader), `${nøkkel} ${n}`).toContain(nr);
        else expect(rad).not.toMatch(/\d{2} \//);
      }
    }
  });
});
