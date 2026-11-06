// AK-1.1-10 Ingen endring i notatfiler, ingen visningsvalg fra frontmatter (P1).
// AK-1.1-11 Full v1-regresjon: dekkes av hele den eksisterende suiten (testplanen §5), ikke av denne fila.
// AK-1.1-12 Nye kontroller er tastatur- og skjermlesertilgjengelige (axe 0 brudd).
// TDD: `test.fixme` fjernes når levert. Testplan: TC-10-*, TC-12-*.
import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, openNote, test } from './support/guards';
import {
  artikkel,
  brødtekstBredde,
  fasit,
  foldKnapp,
  fokusPåInnhold,
  hurtigtastoversikt,
  høyremarg,
  kjørKommando,
  leaderHint,
  palett,
  settDiskret,
  sidepanel,
  trykkSekvens,
  velgLesebredde,
  åpneUtseende,
} from './support/v11';

/** Sjekksum (innhold + mtime) av alle filer i lesekomfort/ i vault-kopien. Ingen andre tester skriver der. */
function sjekksum(vaultDir: string): Record<string, string> {
  const rot = join(vaultDir, 'lesekomfort');
  const ut: Record<string, string> = {};
  const gå = (dir: string) => {
    for (const navn of readdirSync(dir)) {
      const fil = join(dir, navn);
      const st = statSync(fil);
      if (st.isDirectory()) gå(fil);
      else ut[relative(vaultDir, fil)] = `${createHash('sha256').update(readFileSync(fil)).digest('hex')}@${st.mtimeMs}`;
    }
  };
  gå(rot);
  return ut;
}

async function axe(page: Page, hva: string): Promise<void> {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const brudd = res.violations.flatMap((v) => v.nodes.map((n) => `${hva}: ${v.id} ${n.target.join(' ')}`));
  expect(brudd).toEqual([]);
}

test.describe('AK-1.1-10 P1: frontmatter er data, ikke presentasjon (kjører nå)', () => {
  test('TC-10-01 `diskret-embedding`, `lesebredde`, `zen` og `cssclasses` i frontmatter påvirker ikke visningen', async ({ page }) => {
    await openNote(page, 'Velkommen');
    const vanlig = await artikkel(page).boundingBox();
    await openNote(page, fasit.rapport.sti);
    await expect(artikkel(page).getByText('Innebygd fra', { exact: true })).toHaveCount(fasit.rapport.normal.antallRammer);
    await openNote(page, fasit.langBrodtekst.sti);
    await expect(sidepanel(page).or(page.getByRole('banner')).filter({ visible: true }).first()).toBeVisible();
    expect((await artikkel(page).boundingBox())?.width).toBeCloseTo(vanlig?.width ?? -1, 0);
    // Egenskapene vises som data i egenskapspanelet.
    await expect(page.getByText('lesebredde').first()).toBeVisible();
  });
});

test.describe('AK-1.1-10 ingen skriving', () => {
  test.fixme('TC-10-02 alle v1.1-funksjoner i bruk: ingen endrede filer og bare GET/HEAD mot serveren', async ({ page, vaultDir, isMobile }) => {
    test.skip(isMobile, 'Desktop');
    const før = sjekksum(vaultDir);
    const metoder = new Set<string>();
    page.on('request', (r) => metoder.add(r.method()));

    await openNote(page, fasit.rapport.sti);
    await settDiskret(page, true);
    await velgLesebredde(page, 'Full bredde');
    await kjørKommando(page, 'zen');
    await kjørKommando(page, 'fold alle');
    await kjørKommando(page, 'utfold alle');
    await openNote(page, fasit.dypStruktur.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['z', 'Shift+M', 'z', 'Shift+R', 'Space', 'w', 'Shift+G', 'g', 'g']);
    await page.reload();

    expect([...metoder].filter((m) => m !== 'GET' && m !== 'HEAD')).toEqual([]);
    expect(sjekksum(vaultDir)).toEqual(før);
  });

  test.fixme('TC-10-03 visningsvalg lagres bare i nettleseren (localStorage), ikke i URL-en', async ({ page }) => {
    await openNote(page, fasit.rapport.sti);
    const url = page.url();
    await settDiskret(page, true);
    await velgLesebredde(page, 'Full bredde');
    expect(page.url()).toBe(url);
    const lagret = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(lagret).toMatch(/Kvartalsrapport/); // per notat (vault-id + sti)
    expect(lagret).toMatch(/test/); // vault-id
  });
});

test.describe('AK-1.1-12 tilgjengelighet (axe 0 brudd, lys og mørk)', () => {
  for (const mode of ['light', 'dark'] as const) {
    test.fixme(`TC-12-01 ${mode}: Utseende med nye kontroller, diskré rapport, foldet notat, zen`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      await openNote(page, fasit.rapport.sti);
      await åpneUtseende(page);
      await axe(page, 'Utseende');
      await page.keyboard.press('Escape');
      await settDiskret(page, true);
      await axe(page, 'Kvartalsrapport diskré');
      await openNote(page, fasit.dypStruktur.sti);
      await foldKnapp(page, 'Seksjon A').click();
      await axe(page, 'Dyp struktur med foldet seksjon');
      await kjørKommando(page, 'zen');
      await axe(page, 'zen');
    });

    test(`TC-12-02 ${mode}: palett i kommandomodus, hurtigtastoversikt og leader-hint`, async ({ page, isMobile }) => {
      test.skip(isMobile, 'Tastatur');
      await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
      await openNote(page, 'Velkommen');
      await fokusPåInnhold(page);
      await page.keyboard.press(':');
      await expect(palett(page).getByRole('option').first()).toBeVisible();
      await axe(page, 'palett :');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Shift+Slash');
      await expect(hurtigtastoversikt(page)).toBeVisible();
      await axe(page, 'hurtigtastoversikt');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Space');
      await expect(leaderHint(page)).toBeVisible();
      await axe(page, 'leader-hint');
    });
  }

  test('TC-12-03 fold-knappen: rolle, navn, aria-expanded og aria-controls peker på innholdet', async ({ page }) => {
    await openNote(page, fasit.dypStruktur.sti);
    const knapp = foldKnapp(page, 'Seksjon A');
    await expect(knapp).toHaveAttribute('aria-expanded', 'true');
    const kontrollerer = await knapp.getAttribute('aria-controls');
    if (kontrollerer) await expect(page.locator(`[id="${kontrollerer}"]`)).toHaveCount(1);
    await knapp.click();
    await expect(knapp).toHaveAttribute('aria-expanded', 'false');
    await expect(knapp).toBeFocused();
  });

  test.fixme('TC-12-04 nye kontroller i Utseende er nåbare med Tab og har synlig fokus', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur');
    await openNote(page, fasit.rapport.sti);
    const dialog = await åpneUtseende(page);
    const mål = [dialog.getByRole('radio', { name: 'Full bredde' }), dialog.getByLabel('Diskré embedding – dette notatet'), dialog.getByRole('button', { name: 'Hurtigtaster' })];
    for (const m of mål) {
      let funnet = false;
      for (let i = 0; i < 40 && !funnet; i++) {
        await page.keyboard.press('Tab');
        funnet = await m.evaluate((el) => el === document.activeElement || el.contains(document.activeElement));
      }
      expect(funnet, await m.evaluate((el) => el.outerHTML.slice(0, 80))).toBe(true);
      const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle);
      expect(outline).not.toBe('none');
      await page.keyboard.press('Shift+Tab'); // start søket på nytt fra et kjent sted
    }
  });

  test.fixme('TC-12-05 toast ved diskré-bytte annonseres (role=status) og stjeler ikke fokus', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur');
    await openNote(page, fasit.rapport.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'd']);
    await expect(page.getByRole('status').filter({ hasText: /Diskré embedding/ })).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.closest('[role="status"]') ?? null)).toBeNull();
  });

  test('TC-12-06 zen: hopp-lenken og landemerket main finnes fortsatt', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur');
    await openNote(page, fasit.langBrodtekst.sti);
    const bredde = await brødtekstBredde(page);
    await kjørKommando(page, 'zen');
    await expect(høyremarg(page)).toBeHidden();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Hopp til innhold' })).toHaveCount(1);
    expect(await brødtekstBredde(page)).toBeGreaterThan(bredde - 2);
  });
});
