// P1 (videreført i v2): ingen presentasjonsdata leses fra eller skrives til frontmatter/notatet.
// AK-2-14 Full regresjon av v1 og v1.1 er grønn: dekkes av hele den eksisterende suiten (testplanen §5).
//         Denne fila sjekker i tillegg at lesevisningens tilstand er urørt etter en presentasjon.
// Testplan: TC-2-P1-*, TC-2-14-*. TDD: `test.fixme` til levert.
import { expect, openNote, test } from './support/guards';
import {
  avsluttPresentasjon,
  fasit2,
  gåTilLysbilde,
  lesAlleLysbilder,
  lysbilde,
  presenter,
  sjekksum,
  somFasit,
  startPresentasjon,
} from './support/v2';
import { artikkel, foldKnapp, fokusPåInnhold, hurtigtastoversikt, kjørKommando, settDiskret, trykkSekvens } from './support/v11';

const s = fasit2.statusmote;

test.describe('P1 frontmatter er data, ikke presentasjon', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');

  test('TC-2-P1-01 `lysbildeniva`, `agenda: av` og `presenter:` i frontmatter ignoreres (statusmøtet)', async ({ page }) => {
    await presenter(page, s.sti);
    // Lysbildenivå H3 (ikke H4 fra frontmatter) og overganger på (ikke `agenda: av`).
    expect(await lesAlleLysbilder(page)).toEqual(s.lysbilder.map(somFasit));
  });

  test('TC-2-P1-02 `lysbildeniva: h4` i rapportens frontmatter ignoreres', async ({ page }) => {
    await presenter(page, fasit2.rapport.sti);
    expect(await lesAlleLysbilder(page)).toEqual(fasit2.rapport.lysbilder.map(somFasit));
  });

  test('TC-2-P1-03 fellene vises som vanlige egenskaper (data) på tittellysbildet', async ({ page }) => {
    await presenter(page, s.sti);
    await expect(lysbilde(page)).toContainText('lysbildeniva');
  });

  test('TC-2-P1-04 alle v2-funksjoner i bruk: ingen endrede filer og bare GET/HEAD mot serveren', async ({ page, vaultDir }) => {
    test.slow();
    const før = sjekksum(vaultDir);
    const metoder = new Set<string>();
    page.on('request', (r) => metoder.add(r.method()));
    await presenter(page, fasit2.niva.sti, 'h4');
    await trykkSekvens(page, ['j', 'j', 'o', 'ArrowRight', 'Enter', 'b', 'b', 'Shift+G', 'g', 'g']);
    await kjørKommando(page, 'agenda av');
    await page.reload();
    await avsluttPresentasjon(page);
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 7);
    await kjørKommando(page, 'tema terminal');
    await avsluttPresentasjon(page);
    expect([...metoder].filter((m) => m !== 'GET' && m !== 'HEAD')).toEqual([]);
    expect(sjekksum(vaultDir)).toEqual(før);
  });
});

test.describe('AK-2-14 lesevisningen er urørt etter presentasjon', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');

  test('TC-2-14-01 diskré, bredde og folding beholdes etter avsluttet presentasjon (Q-13)', async ({ page }) => {
    await openNote(page, fasit2.rapport.sti);
    await settDiskret(page, false);
    await expect(artikkel(page).getByText('Innebygd fra', { exact: true }).first()).toBeVisible();
    await openNote(page, s.sti);
    await foldKnapp(page, 'Siden sist').click();
    await expect(foldKnapp(page, 'Siden sist')).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => window.scrollTo(0, 0));
    await startPresentasjon(page);
    await avsluttPresentasjon(page);
    await expect(foldKnapp(page, 'Siden sist')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('html')).not.toHaveAttribute('data-zen', 'on');
    await openNote(page, fasit2.rapport.sti);
    await expect(artikkel(page).getByText('Innebygd fra', { exact: true }).first()).toBeVisible();
  });

  test('TC-2-14-02 `?` etter presentasjon viser normal-modusens taster igjen', async ({ page }) => {
    await presenter(page, s.sti);
    await avsluttPresentasjon(page);
    await fokusPåInnhold(page);
    await page.keyboard.press('Shift+Slash');
    await expect(hurtigtastoversikt(page)).toContainText('za');
    await expect(hurtigtastoversikt(page)).toContainText(/Space\s*p|␣\s*p/);
  });

  test('TC-2-14-03 `Space p` vises i normal-modusens oversikt og i paletten med sin primære tast (P2, PO-69)', async ({ page }) => {
    await openNote(page, s.sti);
    await fokusPåInnhold(page);
    await page.keyboard.press(':');
    const felt = page.locator('dialog[open]').getByRole('combobox');
    await felt.pressSequentially('presenter');
    await expect(page.locator('dialog[open]').getByRole('option').first().locator('kbd').first()).toBeVisible();
  });
});
