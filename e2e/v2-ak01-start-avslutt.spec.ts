// AK-2-01 `Space p` og `:presenter` starter presentasjon fra seksjonen ved leseposisjon; `Esc` avslutter
// tilbake til samme sted. Testplan: docs/test/testplan-v2.md (TC-2-01-*).
// TDD: `test.fixme` fjernes av frontend i samme commit som funksjonen leveres.
import { expect, openNote, test } from './support/guards';
import {
  avsluttPresentasjon,
  fasit2,
  lesLysbilde,
  lysbilde,
  overskriftVedLeselinjen,
  presentasjon,
  settLeseposisjon,
  somFasit,
  startPresentasjon,
  ventPåLysbilde,
} from './support/v2';
import { fokusPåInnhold, kjørKommando, leaderHint, trykkSekvens } from './support/v11';

const s = fasit2.statusmote;

test.describe('AK-2-01 start og avslutt', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur testes på desktop (touch: TC-2-10-20)');

  test.fixme('TC-2-01-01 `Space p` fra toppen starter på tittellysbildet', async ({ page }) => {
    await openNote(page, s.sti);
    await startPresentasjon(page, 'leader');
    await ventPåLysbilde(page, 1);
    expect(await lesLysbilde(page)).toEqual(somFasit(s.lysbilder[0]!));
  });

  for (const [seksjon, nr] of Object.entries(s.startFraSeksjon)) {
    test.fixme(`TC-2-01-02 \`Space p\` med leseposisjon i «${seksjon}» starter på lysbilde ${nr}`, async ({ page }) => {
      await openNote(page, s.sti);
      if (seksjon !== s.tittel) await settLeseposisjon(page, seksjon);
      await startPresentasjon(page, 'leader');
      await ventPåLysbilde(page, nr);
      expect(await lesLysbilde(page)).toEqual(somFasit(s.lysbilder[nr - 1]!));
    });
  }

  test.fixme('TC-2-01-03 `:presenter` fra paletten starter fra leseposisjonen', async ({ page }) => {
    await openNote(page, s.sti);
    await settLeseposisjon(page, 'Oppgaver');
    await startPresentasjon(page, 'kommando');
    await ventPåLysbilde(page, s.startFraSeksjon.Oppgaver!);
  });

  test.fixme('TC-2-01-04 `Esc` uten navigasjon: tilbake til samme sted i notatet', async ({ page }) => {
    await openNote(page, s.sti);
    await settLeseposisjon(page, 'Oppgaver');
    const før = await page.evaluate(() => window.scrollY);
    await startPresentasjon(page);
    await avsluttPresentasjon(page);
    expect(await overskriftVedLeselinjen(page)).toBe('Oppgaver');
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - før)).toBeLessThan(60);
    // Normal-modus virker igjen: `j` ruller.
    await fokusPåInnhold(page);
    const y = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('j');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y);
  });

  test.fixme('TC-2-01-05 `Esc` etter navigasjon: lesevisningen står ved seksjonen til siste viste lysbilde (Q-07)', async ({ page }) => {
    await openNote(page, s.sti);
    await startPresentasjon(page);
    // Til «Plan Q1» (siste lysbilde).
    await page.keyboard.press('Shift+G');
    await ventPåLysbilde(page, s.lysbilder.length);
    await avsluttPresentasjon(page);
    expect(await overskriftVedLeselinjen(page)).toBe('Plan Q1');
  });

  test.fixme('TC-2-01-06 `Esc` lukker først oversikt/palett, deretter presentasjonen', async ({ page }) => {
    await openNote(page, s.sti);
    await startPresentasjon(page);
    await page.keyboard.press('o');
    await expect(page.getByRole('dialog', { name: 'Lysbildeoversikt' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Lysbildeoversikt' })).toBeHidden();
    await expect(presentasjon(page)).toBeVisible();
    await page.keyboard.press(':');
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(presentasjon(page)).toBeVisible();
    await avsluttPresentasjon(page);
  });

  test.fixme('TC-2-01-07 `Space p` gir ikke which-key-hint, og `Space` alene starter ikke', async ({ page }) => {
    await openNote(page, s.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'p'], 0);
    await expect(presentasjon(page)).toBeVisible();
    await expect(leaderHint(page)).toBeHidden();
    await avsluttPresentasjon(page);
    await fokusPåInnhold(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);
    await expect(presentasjon(page)).toBeHidden();
    await page.keyboard.press('Escape');
  });

  test.fixme('TC-2-01-08 `:presenter` på en `.base`-side er deaktivert med forklaring', async ({ page }) => {
    await openNote(page, 'Oppgaver.base');
    await kjørKommando(page, 'presenter');
    await expect(presentasjon(page)).toBeHidden();
  });

  test.fixme('TC-2-01-09 presentasjonen viser samme dokument som lesevisningen (ingen ny henting)', async ({ page }) => {
    await openNote(page, s.sti);
    const hentet: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/document')) hentet.push(r.url());
    });
    await startPresentasjon(page);
    await expect(lysbilde(page)).toBeVisible();
    expect(hentet, 'Live-prinsippet: presentasjonen bygges fra dokumentet som allerede er lastet').toEqual([]);
  });
});
