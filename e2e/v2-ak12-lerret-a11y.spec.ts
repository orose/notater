// AK-2-12 16:9-lerret uten horisontal sidescroll ved 1280×720, 1440×900, 1920×1080 og 390×844; WCAG AA
//         (axe-matrisen for alle 24 temakombinasjoner står i v2-ak12-axe-matrise.spec.ts).
// Også: vindusstørrelse som endres under presentasjon, typografi skalert opp, kunngjøring for skjermleser,
// toning/redusert bevegelse. Testplan: TC-2-12-*. TDD: `test.fixme` til levert.
import AxeBuilder from '@axe-core/playwright';
import { expect, openNote, test } from './support/guards';
import {
  boks,
  fasit2,
  forventLerret169,
  gåTilLysbilde,
  kunngjøring,
  kuttetInnhold,
  lerret,
  lysbilde,
  lysbildeInnhold,
  presentasjon,
  presenter,
  startPresentasjon,
  ventPåLysbilde,
} from './support/v2';
import { harHorisontalScroll, kjørKommando } from './support/v11';

const s = fasit2.statusmote;

test.describe('AK-2-12 lerret i fire vindusstørrelser', () => {
  for (const vp of fasit2.lerret.viewports) {
    test.fixme(`TC-2-12-01 ${vp.width}×${vp.height}: 16:9, letterbox, ingen horisontal sidescroll på noe lysbilde`, async ({ page, isMobile }) => {
      test.skip(isMobile !== vp.width < 500, 'Desktop-størrelser i desktop-prosjektet, 390×844 i mobil-prosjektet (touch)');
      test.slow();
      await page.setViewportSize(vp);
      await openNote(page, s.sti);
      await kjørKommando(page, 'presenter');
      await ventPåLysbilde(page, 1);
      for (let i = 1; i <= s.lysbilder.length; i++) {
        await ventPåLysbilde(page, i);
        await forventLerret169(page);
        expect(await harHorisontalScroll(page), `lysbilde ${i}`).toBe(false);
        if ((await lysbildeInnhold(page).count()) > 0) expect(await kuttetInnhold(page), `lysbilde ${i}`).toEqual([]);
        if (i < s.lysbilder.length) await page.keyboard.press('j');
      }
    });
  }

  test.fixme('TC-2-12-02 vindusstørrelsen endres under presentasjon: lerretet tilpasses, lysbildet beholdes', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop');
    await page.setViewportSize({ width: 1440, height: 900 });
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 7);
    for (const vp of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 900, height: 900 }, { width: 1600, height: 500 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(200);
      await ventPåLysbilde(page, 7);
      await forventLerret169(page);
      expect(await harHorisontalScroll(page), `${vp.width}×${vp.height}`).toBe(false);
    }
  });

  test.fixme('TC-2-12-03 typografien er skalert opp for avstand: brødtekst ≈ 40 logiske px, større enn lesevisningen ved 1920×1080', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openNote(page, s.sti);
    const lesefont = await page.locator('main article p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    await startPresentasjon(page);
    await gåTilLysbilde(page, 4);
    const fs = await lysbildeInnhold(page).locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const t = fasit2.lerret.typografi;
    expect(Math.abs(fs - t.brodtekstPx), `brødtekst ${fs} lp`).toBeLessThanOrEqual(t.toleransePx * 2);
    // Ved 1920×1080 er skalaen 1, så logiske px = skjermpiksler.
    expect((await boks(lerret(page))).width).toBeCloseTo(t.logiskBredde, -1);
    expect(fs).toBeGreaterThan(lesefont * 1.5);
  });

  test.fixme('TC-2-12-04 lerretet skaleres som helhet: samme logiske skrift og samme oppdeling ved 1280×720 og 1920×1080', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop');
    const målt: { fs: number; skala: number; antall: number }[] = [];
    for (const vp of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(vp);
      await presenter(page, fasit2.mye.sti);
      const antall = (await page.getByTestId('lysbildenummer').innerText()).replace(/.*\/\s*/, '');
      await gåTilLysbilde(page, 4);
      målt.push({
        fs: await lysbildeInnhold(page).locator('p').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        skala: (await boks(lerret(page))).width / fasit2.lerret.typografi.logiskBredde,
        antall: Number(antall),
      });
      await page.keyboard.press('Escape');
    }
    expect(målt[0]!.fs).toBe(målt[1]!.fs);
    expect(målt[0]!.antall, 'oppdelingen i «(forts.)» avhenger ikke av vinduet').toBe(målt[1]!.antall);
    expect(målt[0]!.skala).toBeCloseTo(1280 / 1920, 2);
  });
});

test.describe('AK-2-12 tilgjengelighet', () => {
  test.fixme('TC-2-12-10 lysbildebytte annonseres: «Lysbilde n av N: ‹overskrift›» i role=status', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur');
    await presenter(page, s.sti);
    await expect(kunngjøring(page)).toHaveAttribute('role', 'status');
    await gåTilLysbilde(page, 5);
    await expect(kunngjøring(page)).toHaveText(`Lysbilde 5 av ${s.lysbilder.length}: ${s.lysbilder[4]!.overskrift}`);
    await page.keyboard.press('k');
    await expect(kunngjøring(page)).toHaveText(`Lysbilde 4 av ${s.lysbilder.length}: ${s.lysbilder[3]!.overskrift}`);
  });

  test.fixme('TC-2-12-11 presentasjonen er en region med lysbildeserie-semantikk; gjeldende lysbilde er en gruppe med navn', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur');
    await presenter(page, s.sti);
    await expect(presentasjon(page)).toHaveAttribute('aria-roledescription', 'lysbildeserie');
    await expect(lysbilde(page)).toHaveAttribute('role', 'group');
    await expect(lysbilde(page)).toHaveAttribute('aria-roledescription', 'lysbilde');
    await expect(lysbilde(page)).toHaveAttribute('aria-label', new RegExp(`1 av ${s.lysbilder.length}`));
    // Lesevisningen bak er skjult for hjelpemidler (inert/aria-hidden), ikke bare visuelt.
    await expect(page.getByRole('navigation', { name: 'Vault' })).toBeHidden();
  });

  test.fixme('TC-2-12-12 fokus: i presentasjonen ved start, tilbake i lesevisningen ved avslutning', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur');
    await presenter(page, s.sti);
    expect(await page.evaluate(() => !!document.activeElement?.closest('[aria-roledescription="lysbildeserie"]'))).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => !document.activeElement?.closest('[aria-roledescription="lysbildeserie"]'))).toBe(true);
  });

  test.fixme('TC-2-12-13 diskret toning ved lysbildebytte, ingen ved prefers-reduced-motion', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur');
    const varighet = () =>
      lysbilde(page).evaluate((el) => {
        const cs = getComputedStyle(el);
        const ms = (v: string) => Math.max(...v.split(',').map((d) => parseFloat(d) * (d.trim().endsWith('ms') ? 1 : 1000)));
        return Math.max(ms(cs.transitionDuration), ms(cs.animationDuration));
      });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await presenter(page, s.sti);
    expect(await varighet()).toBeGreaterThan(0);
    expect(await varighet(), 'diskret (kort) toning').toBeLessThanOrEqual(400);
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await presenter(page, s.sti);
    expect(await varighet()).toBe(0);
  });

  for (const mode of ['light', 'dark'] as const) {
    test.fixme(`TC-2-12-14 axe (${mode}) ved 390×844: tittel, overgang, innhold, kanban`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 390, height: 844 });
      await openNote(page, s.sti);
      await kjørKommando(page, 'presenter');
      for (const nr of [1, 3, 4, 7]) {
        await gåTilLysbilde(page, nr);
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(res.violations.flatMap((v) => v.nodes.map((n) => `#${nr}: ${v.id} ${n.target.join(' ')}`))).toEqual([]);
      }
    });
  }
});
