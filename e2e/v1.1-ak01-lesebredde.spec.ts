// AK-1.1-01 Lesebredde (F1). TDD: skrevet før implementasjonen – `test.fixme` fjernes av frontend når
// funksjonen er levert. Testplan: docs/test/testplan-v1.1.md (TC-01-*). Fasit: docs/test/v1.1-fasit.json.
import { expect, openNote, test } from './support/guards';
import {
  brødtekstBredde,
  fasit,
  fokusPåInnhold,
  harHorisontalScroll,
  høyremarg,
  kjørKommando,
  settDiskret,
  sidepanel,
  trykkSekvens,
  velgLesebredde,
  åpneUtseende,
} from './support/v11';

const LANG = fasit.langBrodtekst;

test.describe('AK-1.1-01 lesebredde på desktop (1440 px)', () => {
  test.skip(({ isMobile }) => isMobile, 'Bredde måles ved 1440 px; 360 px dekkes under');

  test.fixme('TC-01-01 standard er Leseoptimalisert, og Utseende viser valget', async ({ page }) => {
    await openNote(page, LANG.sti);
    const dialog = await åpneUtseende(page);
    await expect(dialog.getByRole('group', { name: 'Lesebredde' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Leseoptimalisert' })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'Full bredde' })).not.toBeChecked();
  });

  test.fixme('TC-01-02 Full bredde via Utseende gir bredere brødtekst og beholder panelene', async ({ page }) => {
    await openNote(page, LANG.sti);
    const lese = await brødtekstBredde(page);
    await velgLesebredde(page, 'Full bredde');
    await expect.poll(() => brødtekstBredde(page)).toBeGreaterThan(lese + LANG.minstBredereFullPx);
    await expect(sidepanel(page)).toBeVisible();
    await expect(høyremarg(page)).toBeVisible();
    // Brødteksten bruker det meste av plassen mellom sidepanelet og høyremargen.
    const venstre = await sidepanel(page).boundingBox();
    const høyre = await høyremarg(page).boundingBox();
    const ledig = (høyre?.x ?? 0) - ((venstre?.x ?? 0) + (venstre?.width ?? 0));
    expect(await brødtekstBredde(page)).toBeGreaterThan(ledig * 0.7);
  });

  test.fixme('TC-01-03 Space w bytter frem og tilbake', async ({ page }) => {
    await openNote(page, LANG.sti);
    const lese = await brødtekstBredde(page);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'w']);
    await expect.poll(() => brødtekstBredde(page)).toBeGreaterThan(lese + LANG.minstBredereFullPx);
    await trykkSekvens(page, ['Space', 'w']);
    await expect.poll(() => brødtekstBredde(page)).toBeLessThan(lese + 2);
  });

  test.fixme('TC-01-04 :bredde i paletten bytter', async ({ page }) => {
    await openNote(page, LANG.sti);
    const lese = await brødtekstBredde(page);
    await kjørKommando(page, 'bredde');
    await expect.poll(() => brødtekstBredde(page)).toBeGreaterThan(lese + LANG.minstBredereFullPx);
  });

  test.fixme('TC-01-05 valget huskes etter reload og gjelder alle notater (globalt)', async ({ page }) => {
    await openNote(page, LANG.sti);
    const lese = await brødtekstBredde(page);
    await velgLesebredde(page, 'Full bredde');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(LANG.tittel);
    await expect.poll(() => brødtekstBredde(page)).toBeGreaterThan(lese + LANG.minstBredereFullPx);
    await openNote(page, fasit.dypStruktur.sti);
    await expect.poll(() => brødtekstBredde(page)).toBeGreaterThan(lese + LANG.minstBredereFullPx);
    const dialog = await åpneUtseende(page);
    await expect(dialog.getByRole('radio', { name: 'Full bredde' })).toBeChecked();
  });

  test.fixme('TC-01-06 full bredde på en .base-side gir ingen feil og ingen horisontal sidescroll', async ({ page }) => {
    await openNote(page, 'Oppgaver.base');
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'w']);
    expect(await harHorisontalScroll(page)).toBe(false);
  });
});

test.describe('AK-1.1-01 ingen horisontal sidescroll ved 360 px i noen tilstand', () => {
  test.skip(({ isMobile }) => !isMobile, 'Mobilprosjektet (360 px)');

  for (const bredde of ['Leseoptimalisert', 'Full bredde'] as const) {
    test.fixme(`TC-01-07 ${bredde}: Lang brødtekst, Kvartalsrapport (diskré) og Dyp struktur (foldet)`, async ({ page }) => {
      await openNote(page, LANG.sti);
      await velgLesebredde(page, bredde);
      expect(await harHorisontalScroll(page), LANG.sti).toBe(false);

      await openNote(page, fasit.rapport.sti);
      expect(await harHorisontalScroll(page), 'rapport, rammer').toBe(false);
      await settDiskret(page, true);
      expect(await harHorisontalScroll(page), 'rapport, diskré').toBe(false);

      await openNote(page, fasit.dypStruktur.sti);
      await kjørKommando(page, 'fold alle');
      expect(await harHorisontalScroll(page), 'dyp struktur, foldet').toBe(false);
    });
  }
});
