// AK-2-08 For mye innhold: krymping til minimum, deretter «(forts.)»-lysbilder; ingen splitting inne i kode/
//         tabell/diagram/base; ingen innhold kuttes usynlig.
// AK-2-09 Bases (tabell/kanban) og Mermaid vises tilpasset lerretet; kanbanendringer i vaultet oppdateres live.
// A4 Fotnoter nederst på lysbildet de hører til.
// Testplan: TC-2-08-*, TC-2-09-*. TDD: `test.fixme` til levert.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './support/guards';
import {
  boks,
  fasit2,
  gåTilLysbilde,
  kuttetInnhold,
  lerret,
  lesLysbilde,
  liveTest,
  lysbilde,
  lysbildeInnhold,
  lysbildeOverskrift,
  minsteSkrift,
  nummer,
  presenter,
  startPresentasjon,
  ventPåLysbilde,
} from './support/v2';

const VIEWPORT = { width: 1440, height: 900 };
const typo = fasit2.lerret.typografi;

/** Skriftminimum i logiske px (PO-86: ≈ 30 px på 1920×1080-lerretet). Uavhengig av vindusstørrelsen (ADR-010 §2). */
function minimumPx(): number {
  return typo.minimumPx - typo.toleransePx;
}

/** Nummeret til første lysbilde med denne overskriften. */
function nr(lysbilder: readonly { overskrift: string | null }[], overskrift: string): number {
  return lysbilder.findIndex((l) => l.overskrift === overskrift) + 1;
}

test.describe('AK-2-08 for mye innhold', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur; 390 px dekkes av TC-2-12-*');
  test.beforeEach(async ({ page }) => page.setViewportSize(VIEWPORT));
  const m = fasit2.mye;

  test('TC-2-08-01 langt lysbilde krympes og fortsetter som «(forts.)»; alle markører nøyaktig én gang, i rekkefølge', async ({ page }) => {
    test.slow();
    await presenter(page, m.sti);
    await gåTilLysbilde(page, 4);
    const deler: string[] = [];
    const overskrifter: string[] = [];
    for (;;) {
      const l = await lesLysbilde(page);
      if (l.overskrift === m.sisteLysbilde.overskrift) break;
      overskrifter.push(l.overskrift ?? '');
      deler.push(await lysbildeInnhold(page).innerText());
      expect(await kuttetInnhold(page), `del ${deler.length}`).toEqual([]);
      expect(await minsteSkrift(page), `skrift ≥ minimum, del ${deler.length}`).toBeGreaterThanOrEqual(minimumPx());
      await page.keyboard.press('j');
    }
    expect(deler.length).toBeGreaterThanOrEqual(m.minstDeler);
    expect(overskrifter[0]).toBe(m.overskrift);
    for (const o of overskrifter.slice(1)) expect(o).toBe(`${m.overskrift}${fasit2.forts}`);
    const alt = deler.join('\n');
    const posisjoner = m.markorer.map((mk) => alt.indexOf(mk));
    for (const [i, mk] of m.markorer.entries()) {
      expect(alt.split(mk).length - 1, `${mk} vises nøyaktig én gang`).toBe(1);
      if (i > 0) expect(posisjoner[i]!, `${mk} etter ${m.markorer[i - 1]}`).toBeGreaterThan(posisjoner[i - 1]!);
    }
    // Siste lysbilde (kort) påvirkes ikke og får progresjon N/N.
    const siste = await lesLysbilde(page);
    expect(siste.progresjon).toBe(`${deler.length + 1}/${deler.length + 1}`);
  });

  test('TC-2-08-02 krymping skjer før splitting: første del bruker mindre skrift enn et kort lysbilde', async ({ page }) => {
    await presenter(page, m.sti);
    await gåTilLysbilde(page, 4);
    const lang = await minsteSkrift(page);
    await page.keyboard.press('Shift+G');
    const kort = await minsteSkrift(page);
    expect(lang).toBeLessThan(kort);
    expect(kort).toBeGreaterThanOrEqual(typo.brodtekstPx - typo.toleransePx);
  });

  test('TC-2-08-03 et listepunkt deles aldri mellom to lysbilder', async ({ page }) => {
    await presenter(page, m.sti);
    await gåTilLysbilde(page, 4);
    const sett = new Map<string, number>();
    for (let del = 1; ; del++) {
      const l = await lesLysbilde(page);
      if (l.overskrift === m.sisteLysbilde.overskrift) break;
      const punkter = await lysbildeInnhold(page).locator('li').allInnerTexts();
      for (const p of punkter) {
        const id = /MYE-L\d+/.exec(p)?.[0];
        if (!id) continue;
        expect(p, `${id} er helt`).toMatch(/tar plass på lysbildet\.$/);
        sett.set(id, (sett.get(id) ?? 0) + 1);
      }
      await page.keyboard.press('j');
    }
    expect([...sett.values()].every((n) => n === 1)).toBe(true);
    expect(sett.size).toBe(20);
  });

  test('TC-2-08-04 for stor kodeblokk: ett lysbilde, minimumsskrift og intern rulling, ingen «(forts.)»', async ({ page }) => {
    const st = fasit2.stor;
    await presenter(page, st.sti);
    await gåTilLysbilde(page, nr(st.lysbilder, 'Lang kode'));
    await expect(lysbildeOverskrift(page)).toHaveText('Lang kode');
    const pre = lysbildeInnhold(page).locator('pre').first();
    await expect(pre).toContainText('STOR-KODE 001');
    await expect(pre).toContainText('STOR-KODE 120');
    const r = await pre.evaluate((el) => {
      const rul = [el, ...el.querySelectorAll('*')].find((n) => n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY));
      return { rullbar: !!rul, fs: parseFloat(getComputedStyle(el.querySelector('code') ?? el).fontSize), fokuserbar: (rul as HTMLElement | undefined)?.tabIndex ?? -1 };
    });
    expect(r.rullbar, 'kodeblokken ruller internt').toBe(true);
    // Kode har eget gulv (--slide-mono-min-lp = 24 lp, designsystem §12.3): 0,8 × brødtekstminimum. Endret av frontend.
    expect(r.fs).toBeGreaterThanOrEqual(24 - typo.toleransePx);
    expect(r.fokuserbar, 'rullbar flate kan nås med tastatur (WCAG 2.1.1)').toBeGreaterThanOrEqual(0);
    expect(await kuttetInnhold(page)).toEqual([]);
    await page.keyboard.press('j');
    await expect(lysbildeOverskrift(page)).toHaveText('Høyt diagram');
  });

  test('TC-2-08-05 høyt Mermaid-diagram skaleres ned til lerretet (ingen rulling, ingen splitting)', async ({ page }) => {
    const st = fasit2.stor;
    await presenter(page, st.sti);
    await gåTilLysbilde(page, nr(st.lysbilder, 'Høyt diagram'));
    const svg = lysbildeInnhold(page).locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 15_000 });
    const s = await boks(svg);
    const l = await boks(lerret(page));
    expect(s.y + s.height).toBeLessThanOrEqual(l.y + l.height + 1);
    expect(s.x + s.width).toBeLessThanOrEqual(l.x + l.width + 1);
    expect(await kuttetInnhold(page)).toEqual([]);
    await expect(lysbilde(page)).toContainText('Steg 25');
  });

  test('TC-2-08-06 for stor tabell: ett lysbilde, minimumsskrift og intern rulling', async ({ page }) => {
    const st = fasit2.stor;
    await presenter(page, st.sti);
    await gåTilLysbilde(page, nr(st.lysbilder, 'Bred tabell'));
    const tabell = lysbildeInnhold(page).locator('table').first();
    await expect(tabell).toContainText('R01K01');
    await expect(tabell).toContainText('R40K12');
    const rullbar = await tabell.evaluate((t) => {
      for (let n: Element | null = t; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if ((n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1) && /(auto|scroll)/.test(cs.overflowY + cs.overflowX)) return true;
        if (n.getAttribute('data-testid') === 'lysbilde') break;
      }
      return false;
    });
    expect(rullbar).toBe(true);
    expect(await kuttetInnhold(page)).toEqual([]);
    expect((await nummer(page)).av).toBe(st.lysbilder.length);
  });

  test('TC-2-08-07 ingen lysbilde i noen fasitnotat har avkuttet innhold (1440×900)', async ({ page }) => {
    test.slow();
    for (const n of [fasit2.statusmote, fasit2.rapport, fasit2.delte, fasit2.stor, fasit2.mange]) {
      await presenter(page, n.sti);
      const { av } = await nummer(page);
      for (let i = 1; i <= av; i++) {
        await ventPåLysbilde(page, i);
        if ((await lysbildeInnhold(page).count()) > 0) expect(await kuttetInnhold(page), `${n.sti} #${i}`).toEqual([]);
        if (i < av) await page.keyboard.press('j');
      }
    }
  });
});

test.describe('AK-2-09 bases, Mermaid og fotnoter', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');
  test.beforeEach(async ({ page }) => page.setViewportSize(VIEWPORT));
  const s = fasit2.statusmote;
  const oppgaver = s.lysbilder.find((l) => l.base)!;

  test('TC-2-09-01 kanban: alle kolonner og kort synlige innenfor lerretet', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, nr(s.lysbilder, 'Oppgaver'));
    // `![[Oppgaver.base#Kanban]]` (PO-100). Samme kontrakt som v1 (e2e/bases.spec.ts): region «Kanban: ‹view›»,
    // kolonner `section.lane`, kort `a.card`.
    const tavle = lysbildeInnhold(page).getByRole('region', { name: `Kanban: ${oppgaver.base!.view}` });
    await expect(tavle).toBeVisible();
    const kolonner = tavle.locator('section.lane');
    await expect(kolonner).toHaveCount(oppgaver.base!.kolonner);
    const l = await boks(lerret(page));
    for (let i = 0; i < oppgaver.base!.kolonner; i++) {
      const k = await boks(kolonner.nth(i));
      expect(k.x, `kolonne ${i + 1} innenfor lerretet`).toBeGreaterThanOrEqual(l.x - 1);
      expect(k.x + k.width).toBeLessThanOrEqual(l.x + l.width + 1);
    }
    await expect(tavle.locator('a.card')).toHaveCount(oppgaver.base!.kort);
    // Ingen intern rulling trengs ved 1440×900 (A3: «alle kolonner om mulig»).
    // Regionen «Kanban: …» er selve `.kanban` (BaseKanban), ikke en forelder. Endret av frontend.
    expect(await tavle.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await kuttetInnhold(page)).toEqual([]);
  });

  test('TC-2-09-02 Mermaid i statusmøtet vises tilpasset lerretet', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, nr(s.lysbilder, 'Flyt i presentasjonen'));
    const svg = lysbildeInnhold(page).locator('svg').first();
    await expect(svg).toBeVisible({ timeout: 15_000 });
    const b = await boks(svg);
    const l = await boks(lerret(page));
    expect(b.width).toBeGreaterThan(l.width * 0.3);
    expect(b.x + b.width).toBeLessThanOrEqual(l.x + l.width + 1);
    expect(b.y + b.height).toBeLessThanOrEqual(l.y + l.height + 1);
  });

  test('TC-2-09-03 tabell i rapportens seksjonsembed og i Plan Q1 vises uten avkutting', async ({ page }) => {
    for (const [n, overskrift] of [[s, 'Plan Q1'], [fasit2.rapport, 'Milepæler']] as const) {
      await presenter(page, n.sti);
      await gåTilLysbilde(page, nr(n.lysbilder, overskrift));
      await expect(lysbildeInnhold(page).locator('table')).toBeVisible();
      expect(await kuttetInnhold(page)).toEqual([]);
    }
  });

  test('TC-2-09-04 fotnoten vises nederst på lysbildet den hører til (A4), ikke på andre', async ({ page }) => {
    const plan = s.lysbilder.find((l) => l.fotnote)!;
    await presenter(page, s.sti);
    await gåTilLysbilde(page, nr(s.lysbilder, plan.overskrift!));
    const note = lysbilde(page).getByText(plan.fotnote!);
    await expect(note).toBeVisible();
    const n = await boks(note);
    const l = await boks(lerret(page));
    expect(n.y, 'nederst på lysbildet').toBeGreaterThan(l.y + l.height * 0.6);
    const fs = await note.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const brødtekst = await lysbildeInnhold(page).locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fs, 'små noter').toBeLessThan(brødtekst);
    await page.keyboard.press('k');
    await expect(lysbilde(page).getByText(plan.fotnote!)).toHaveCount(0);
  });
});

liveTest.describe('AK-2-09 live data i base under presentasjon', () => {
  liveTest.skip(({ isMobile }) => isMobile, 'Desktop');
  const s = fasit2.statusmote;
  const b = s.lysbilder.find((l) => l.base)!.base!;

  liveTest('TC-2-09-05 endret status i en oppgave flytter kortet i kanban uten å miste lysbildet', async ({ page, live }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto(live.url(s.sti));
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await startPresentasjon(page);
    const oppgaverNr = nr(s.lysbilder, 'Oppgaver');
    await gåTilLysbilde(page, oppgaverNr);
    const kolonne = (verdi: string) =>
      lysbildeInnhold(page).locator('section.lane').filter({ has: page.locator('.lane-head .label', { hasText: new RegExp(`^${verdi}$`) }) }).first();
    await expect(kolonne(b.fra)).toContainText(b.liveKort);
    const fil = join(live.vault, b.liveFil);
    writeFileSync(fil, readFileSync(fil, 'utf8').replace(`status: ${b.fra}`, `status: ${b.til}`));
    await expect(kolonne(b.til)).toContainText(b.liveKort, { timeout: 5000 });
    await expect(kolonne(b.fra)).not.toContainText(b.liveKort);
    expect((await nummer(page)).n).toBe(oppgaverNr);
  });
});
