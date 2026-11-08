// AK-1.1-02 og AK-1.1-03 Diskré embedding (F2). TDD: `test.fixme` fjernes når funksjonen er levert.
// Rapportnotatet lesekomfort/Kvartalsrapport består nesten bare av embeds. Fasit: docs/test/v1.1-fasit.json
// (rapport.diskret) og test-vault/README-QA.md §19. Testplan: TC-02-*, TC-03-*.
import { expect, openNote, test } from './support/guards';
import {
  artikkel,
  fasit,
  foldKnapp,
  fokusPåInnhold,
  forventSynlig,
  forventUsynlig,
  kildelenke,
  kjørKommando,
  overskrifterIArtikkel,
  paragrafOverskrifter,
  rammerRundt,
  settDiskret,
  tocTekster,
  toast,
  trykkSekvens,
  åpneUtseende,
} from './support/v11';

const R = fasit.rapport;
const D = R.diskret;
const rammeEtiketter = (page: import('@playwright/test').Page) => artikkel(page).getByText('Innebygd fra', { exact: true });

test.describe('AK-1.1-02 av/på per notat', () => {
  test('TC-02-00 utgangspunkt: rapporten åpnes med vanlige rammer (P1: frontmatter `diskret-embedding: true` ignoreres)', async ({ page }) => {
    await openNote(page, R.sti);
    await expect(rammeEtiketter(page)).toHaveCount(R.normal.antallRammer);
  });

  test('TC-02-01 Utseende: «Diskré embedding – dette notatet» slår av rammene og viser toast', async ({ page }) => {
    await openNote(page, R.sti);
    await settDiskret(page, true);
    await expect(rammeEtiketter(page)).toHaveCount(0);
    await expect(toast(page)).toBeVisible();
    await settDiskret(page, false);
    await expect(rammeEtiketter(page)).toHaveCount(R.normal.antallRammer);
  });

  test('TC-02-02 Space d bytter, med toast', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur testes på desktop');
    await openNote(page, R.sti);
    await fokusPåInnhold(page);
    await trykkSekvens(page, ['Space', 'd']);
    await expect(rammeEtiketter(page)).toHaveCount(0);
    await expect(toast(page)).toContainText(/på/i);
    await trykkSekvens(page, ['Space', 'd']);
    await expect(rammeEtiketter(page)).toHaveCount(R.normal.antallRammer);
    await expect(toast(page)).toContainText(/av/i);
  });

  test('TC-02-03 :diskret i paletten bytter', async ({ page }) => {
    await openNote(page, R.sti);
    await kjørKommando(page, 'diskret');
    await expect(rammeEtiketter(page)).toHaveCount(0);
  });

  test('TC-02-04 gjelder kun gjeldende notat; andre notater er upåvirket; huskes per notat etter reload', async ({ page }) => {
    await openNote(page, R.sti);
    await settDiskret(page, true);
    await expect(rammeEtiketter(page)).toHaveCount(0);

    // Embed-test er upåvirket, og kontrollen i Utseende viser «av» der.
    await openNote(page, 'lenker/Embed-test');
    await expect(artikkel(page).getByText('Innebygd fra', { exact: true }).first()).toBeVisible();
    const dialog = await åpneUtseende(page);
    await expect(dialog.getByLabel('Diskré embedding – dette notatet')).not.toBeChecked();
    await page.keyboard.press('Escape');

    // Tilbake (historikk) og reload: fortsatt diskré.
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(R.tittel);
    await expect(rammeEtiketter(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(R.tittel);
    await expect(rammeEtiketter(page)).toHaveCount(0);

    // Embed-test er fortsatt upåvirket etter reload.
    await openNote(page, 'lenker/Embed-test');
    await expect(artikkel(page).getByText('Innebygd fra', { exact: true }).first()).toBeVisible();
  });

  test('TC-02-05 diskré på et notat som selv er innebygd et annet sted påvirker ikke vertsnotatet', async ({ page }) => {
    // Driftsstatus er kilde i rapporten. Diskré på Driftsstatus skal ikke gjøre rapportens embeds diskré.
    await openNote(page, 'lesekomfort/kilder/Driftsstatus');
    await settDiskret(page, true);
    await openNote(page, R.sti);
    await expect(rammeEtiketter(page)).toHaveCount(R.normal.antallRammer);
  });
});

test.describe('AK-1.1-03 visning i diskré modus', () => {
  // Diskré slås på via Utseende (virker også på mobil).
  test.beforeEach(async ({ page }) => {
    await openNote(page, R.sti);
    await settDiskret(page, true);
  });

  test('TC-03-01 ingen ramme, ingen «Innebygd fra»-etikett, ingen «Åpne notat»-knapp', async ({ page }) => {
    await expect(rammeEtiketter(page)).toHaveCount(0);
    await expect(artikkel(page).getByRole('link', { name: /Åpne notat/ })).toHaveCount(0);
    for (const tekst of Object.keys(D.kilder)) {
      expect(await rammerRundt(artikkel(page).getByText(tekst, { exact: false }).first()), tekst).toEqual([]);
    }
  });

  test('TC-03-02 overskriftsnivåer: tittel ett nivå under nærmeste foregående overskrift (maks H6), seksjon justert, blokk uten overskrift', async ({ page }) => {
    expect(await overskrifterIArtikkel(page)).toEqual(D.overskrifter.map(([n, t]) => [n, t]));
  });

  test('TC-03-03 tittelen til et notat med egen H1 vises én gang (ikke dobbelt)', async ({ page }) => {
    const tekster = (await overskrifterIArtikkel(page)).map(([, t]) => t);
    expect(tekster.filter((t) => t === 'Driftsstatus')).toHaveLength(1);
  });

  test('TC-03-04 innebygde overskrifter er med i innholdsfortegnelsen', async ({ page, isMobile }) => {
    test.skip(isMobile, 'TOC i høyremargen på desktop; mobil-TOC dekkes av TC-03-11');
    await expect.poll(() => tocTekster(page)).toEqual([...D.toc]);
  });

  test('TC-03-05 §-nummerering løper sammenhengende gjennom innebygde H2-er (Tidsskrift, standard)', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-type', 'tidsskrift');
    const { nummer, tekster, vist } = await paragrafOverskrifter(page);
    expect(tekster).toEqual([...D.paragrafer]);
    expect(nummer).toEqual(D.paragrafer.map((_, i) => i + 1));
    expect(vist.every(Boolean), '§ vises i Tidsskrift').toBe(true);
  });

  test('TC-03-15 §-nummer endres ikke når en seksjon foldes (ADR-009 beslutning 4)', async ({ page }) => {
    // Del I inneholder de nummererte H2-ene Driftsstatus og Nøkkeltall; de skal beholde numrene (skjult).
    await foldKnapp(page, 'Del I – Drift').click();
    const { nummer, tekster } = await paragrafOverskrifter(page);
    expect(tekster).toEqual([...D.paragrafer]);
    expect(nummer).toEqual(D.paragrafer.map((_, i) => i + 1));
  });

  test('TC-03-06 kildelenke vises ved hover på den innebygde seksjonen', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Hover finnes ikke på touch – se TC-03-12');
    await page.mouse.move(0, 0);
    const lenke = kildelenke(page, 'Driftsstatus').first();
    await forventUsynlig(lenke);
    await artikkel(page).getByText('Driften i kvartalet var stabil.').hover();
    await forventSynlig(lenke);
    await expect(lenke).toHaveAttribute('href', /lesekomfort\/kilder\/Driftsstatus$/);
  });

  test('TC-03-07 kildelenke vises ved tastaturfokus i den innebygde seksjonen', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Tastatur testes på desktop');
    await page.mouse.move(0, 0);
    const lenke = kildelenke(page, 'Driftsstatus').first();
    await foldKnapp(page, 'Hendelser').first().focus();
    await forventSynlig(lenke);
    // Lenken selv er nåbar med Tab og synlig når den har fokus.
    await lenke.focus();
    await forventSynlig(lenke);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('Driftsstatus');
  });

  test('TC-03-08 nestede embeds arver diskré modus (Plan i Leveranser)', async ({ page }) => {
    const plan = artikkel(page).getByText('Neste kvartal prioriteres stabilitet foran nye funksjoner.');
    await expect(plan).toBeVisible();
    expect(await rammerRundt(plan)).toEqual([]);
    await expect(kildelenke(page, 'Plan')).toHaveCount(1);
  });

  test('TC-03-09 feilkort (manglende, syklus, dybdegrense) er fortsatt synlige', async ({ page }) => {
    for (const kort of D.feilkort) await expect(artikkel(page).getByText(kort).first(), kort).toBeVisible();
    for (const tekst of D.aldriSynlig) await expect(artikkel(page).getByText(tekst)).toHaveCount(0);
  });

  test('TC-03-10 baser og bilder er uendret', async ({ page }) => {
    const base = artikkel(page).getByRole('region', { name: /^Base/ }).or(artikkel(page).locator('section.base')).first();
    await expect(base).toBeVisible();
    await expect(base.locator('tbody tr')).toHaveCount(R.uendret.baseRader);
    const bilde = artikkel(page).locator(`img[src*="${R.uendret.bilde}"]`);
    await expect(bilde).toBeVisible();
    const diskret = { base: await base.boundingBox(), bilde: await bilde.boundingBox() };
    await settDiskret(page, false);
    const normal = { base: await base.boundingBox(), bilde: await bilde.boundingBox() };
    expect(diskret.bilde?.width).toBeCloseTo(normal.bilde?.width ?? -1, 0);
    expect(diskret.base?.width).toBeCloseTo(normal.base?.width ?? -1, 0);
  });

  test('TC-03-11 mobil: innebygde overskrifter er med i den sammenleggbare TOC-en', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobil');
    const toc = page.getByRole('navigation', { name: 'Innhold (kompakt)' });
    await toc.getByText(/Innhold/).first().click();
    for (const t of ['Sammendrag', 'Driftsstatus', 'Leveranser', 'Trinn 1']) await expect(toc.getByRole('link', { name: t }).first()).toBeVisible();
  });

  test('TC-03-12 touch: kildelenken kan nås uten hover (trykk i seksjonen viser den)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Touch');
    await artikkel(page).getByText('Driften i kvartalet var stabil.').tap();
    await forventSynlig(kildelenke(page, 'Driftsstatus').first());
  });

  test('TC-03-13 overskrifter i innebygde notater kan foldes; selve embeden kan ikke foldes som blokk', async ({ page }) => {
    await foldKnapp(page, 'Driftsstatus').first().click();
    await expect(artikkel(page).getByText('Driften i kvartalet var stabil.')).toBeHidden();
    await expect(foldKnapp(page, 'Driftsstatus').first()).toHaveAttribute('aria-expanded', 'false');
    // Vertsnotatets neste overskrift (H2 Nøkkeltall) er utenfor seksjonen.
    await expect(artikkel(page).getByText('Kapasiteten er tilstrekkelig ut neste kvartal.').last()).toBeVisible();
    // Ingen fold-knapp for embed-blokken i seg selv (blokkembeden ^oppetid har ingen overskrift).
    await expect(artikkel(page).getByRole('button', { name: /^Fold (sammen|ut) «?Innebygd/ })).toHaveCount(0);
  });

  test('TC-03-14 fold av vertsnotatets H1 skjuler alt innebygd innhold frem til neste H1', async ({ page }) => {
    await foldKnapp(page, 'Del I – Drift').click();
    await expect(artikkel(page).getByText('Driften i kvartalet var stabil.')).toBeHidden();
    await expect(artikkel(page).getByText('Neste kvartal prioriteres stabilitet foran nye funksjoner.')).toBeHidden();
    await expect(artikkel(page).getByText('Fant ikke «Finnes ikke i rapporten»')).toBeVisible();
  });
});

test.describe('AK-1.1-02/05 kontekst', () => {
  test('TC-02-06 :diskret er deaktivert med forklaring på en .base-side', async ({ page }) => {
    await openNote(page, 'Oppgaver.base');
    await fokusPåInnhold(page);
    await page.keyboard.press(':');
    await page.keyboard.type('diskret');
    const valg = page.getByRole('option').filter({ hasText: /diskr/i }).first();
    await expect(valg).toHaveAttribute('aria-disabled', 'true');
    await expect(valg).toContainText(/ikke|kun|bare/i);
    await page.keyboard.press('Enter');
    await expect(toast(page)).toHaveCount(0);
  });

  test('TC-02-07 Utseende-kontrollen er deaktivert (med forklaring) på en .base-side', async ({ page }) => {
    await openNote(page, 'Oppgaver.base');
    const dialog = await åpneUtseende(page);
    await expect(dialog.getByLabel('Diskré embedding – dette notatet')).toBeDisabled();
  });
});
