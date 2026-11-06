// AK-1.1-06 Én palett (F5) og AK-1.1-07 Hurtigtastoversikt (F6). TDD: `test.fixme` fjernes når levert.
// Testplan: TC-06-*, TC-07-*. Selektorer: testplanen §6.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { lastRegister } from './support/keymap-rules';
import { REPO } from './support/real-server';
import { expect, openNote, test } from './support/guards';
import {
  artikkel,
  erZen,
  fasit,
  fokusPåInnhold,
  hurtigtastoversikt,
  kjørKommando,
  normaliserVisning,
  palett,
  palettInput,
  trykkNorsk,
  åpneUtseende,
} from './support/v11';

interface Rad {
  readonly id: string | null;
  readonly navn: string;
  readonly taster: string[];
}

/** Radene i hurtigtastoversikten: `data-testid="hurtigtast-rad"`, `data-command-id`, navn, én `<kbd>` per tast/alternativ. */
async function raderIOversikt(page: Page): Promise<Rad[]> {
  return hurtigtastoversikt(page)
    .getByTestId('hurtigtast-rad')
    .evaluateAll((rader) =>
      rader.map((rad) => {
        // Alternativer (f.eks. «Space m» og «⌘.») står i hvert sitt element med data-testid="hurtigtast-binding".
        const bindinger = [...rad.querySelectorAll('[data-testid="hurtigtast-binding"]')];
        const kilder = bindinger.length > 0 ? bindinger : [rad];
        const taster = kilder.map((b) => [...b.querySelectorAll('kbd')].map((k) => (k.textContent ?? '').trim()).join(' '));
        const navnEl = rad.querySelector('[data-testid="hurtigtast-navn"]');
        return { id: rad.getAttribute('data-command-id'), navn: (navnEl?.textContent ?? '').trim(), taster };
      }),
    );
}

async function åpneOversikt(page: Page): Promise<Locator> {
  await fokusPåInnhold(page);
  await page.keyboard.press('Shift+Slash'); // «?» på US-layout; norsk: se TC-07-04
  await expect(hurtigtastoversikt(page)).toBeVisible();
  return hurtigtastoversikt(page);
}

test.describe('AK-1.1-06 én palett for søk og kommandoer', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur testes på desktop; mus/touch i TC-06-11');

  test.fixme('TC-06-01 ⌘K/Ctrl K gir tomt notatsøk', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palettInput(page)).toBeFocused();
    await expect(palettInput(page)).toHaveValue('');
    await palettInput(page).fill('kafka grunn');
    await expect(palett(page).getByRole('option').first()).toContainText('Kafka-grunnleggende');
  });

  test.fixme('TC-06-02 / gir tomt notatsøk (uten at «/» havner i feltet)', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await page.keyboard.press('/');
    await expect(palettInput(page)).toBeFocused();
    await expect(palettInput(page)).toHaveValue('');
  });

  test.fixme('TC-06-03 : gir kommandomodus, forhåndsutfylt med «:», og kommandoene viser hurtigtasten sin', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await page.keyboard.press(':');
    await expect(palettInput(page)).toHaveValue(':');
    const valg = palett(page).getByRole('option');
    await expect.poll(() => valg.count()).toBeGreaterThan(10);
    await palettInput(page).pressSequentially('bredde');
    await expect(valg.first().locator('kbd').first()).toBeVisible();
    expect(normaliserVisning(await valg.first().locator('kbd').allInnerTexts().then((t) => t.join(' ')))).toBe('␣w');
  });

  test.fixme('TC-06-04 Backspace over «:» går tilbake til notatsøk', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await page.keyboard.press(':');
    await page.keyboard.press('Backspace');
    await expect(palettInput(page)).toHaveValue('');
    await palettInput(page).fill('kafka grunn');
    await expect(palett(page).getByRole('option').first()).toContainText('Kafka-grunnleggende');
  });

  const effekter: [string, string, (page: Page) => Promise<void>][] = [
    ['zen', 'lesekomfort/Lang brødtekst', async (page) => expect.poll(() => erZen(page, false)).toBe(true)],
    ['zn', 'lesekomfort/Lang brødtekst', async (page) => expect.poll(() => erZen(page, false)).toBe(true)], // fuzzy
    ['diskret', 'lesekomfort/Kvartalsrapport', async (page) => expect(artikkel(page).getByText('Innebygd fra', { exact: true })).toHaveCount(0)],
    ['tema terminal', 'Velkommen', async (page) => expect(page.locator('html')).toHaveAttribute('data-type', 'terminal')],
    ['palett fosfor', 'Velkommen', async (page) => expect(page.locator('html')).toHaveAttribute('data-palette', 'fosfor')],
    ['mørk', 'Velkommen', async (page) => expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')],
    ['fold alle', 'lesekomfort/Dyp struktur', async (page) => expect(artikkel(page).getByText('Markør A-2.')).toBeHidden()],
    ['hjelp', 'Velkommen', async (page) => expect(hurtigtastoversikt(page)).toBeVisible()],
    ['taster', 'Velkommen', async (page) => expect(hurtigtastoversikt(page)).toBeVisible()],
  ];
  for (const [søk, sti, forvent] of effekter) {
    test.fixme(`TC-06-05 :${søk} kjører kommandoen`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await openNote(page, sti);
      await kjørKommando(page, søk);
      await forvent(page);
    });
  }

  test.fixme('TC-06-06 :lys etter :mørk gir lys modus', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openNote(page, 'Velkommen');
    await kjørKommando(page, 'lys');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  });

  test.fixme('TC-06-07 kommandoer med argument tilbyr verdiene som underliste (:tema)', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await page.keyboard.press(':');
    await palettInput(page).pressSequentially('tema ');
    for (const navn of ['Tidsskrift', 'Terminal', 'Klartekst']) await expect(palett(page).getByRole('option', { name: new RegExp(navn) })).toBeVisible();
    await palettInput(page).pressSequentially('kla');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-type', 'klartekst');
  });

  test.fixme('TC-06-08 kontekstløse kommandoer er deaktivert med forklaring (:diskret på .base)', async ({ page }) => {
    await openNote(page, 'Oppgaver.base');
    await fokusPåInnhold(page);
    await page.keyboard.press(':');
    await palettInput(page).pressSequentially('diskret');
    const valg = palett(page).getByRole('option').first();
    await expect(valg).toHaveAttribute('aria-disabled', 'true');
    await expect(valg).toContainText(/ikke tilgjengelig|bare|kun/i);
  });

  test.fixme('TC-06-09 alle kommandoer i oversikten finnes i paletten med samme hurtigtast', async ({ page }) => {
    await openNote(page, 'lesekomfort/Kvartalsrapport');
    await åpneOversikt(page);
    const rader = await raderIOversikt(page);
    expect(rader.length).toBeGreaterThan(10);
    await page.keyboard.press('Escape');
    for (const rad of rader) {
      await fokusPåInnhold(page);
      await page.keyboard.press(':');
      await palettInput(page).pressSequentially(rad.navn);
      const valg = palett(page).getByRole('option').filter({ hasText: rad.navn }).first();
      await expect(valg, rad.navn).toBeVisible();
      if (rad.id) await expect(valg).toHaveAttribute('data-command-id', rad.id);
      const vist = normaliserVisning((await valg.locator('kbd').allInnerTexts()).join(' '));
      expect(vist, `${rad.navn}: palett viser samme (første) hurtigtast som oversikten`).toBe(normaliserVisning(rad.taster[0] ?? ''));
      await page.keyboard.press('Escape');
    }
  });

  test.fixme('TC-06-10 Esc lukker paletten og returnerer fokus', async ({ page }) => {
    await openNote(page, 'Velkommen');
    const knapp = page.getByRole('button', { name: 'Søk i notater' });
    await knapp.focus();
    await page.keyboard.press(':');
    await expect(palett(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palett(page)).toHaveCount(0);
    await expect(knapp).toBeFocused();
  });
});

test.describe('AK-1.1-06 palett med mus/touch (P6)', () => {
  test.fixme('TC-06-11 kommando kan kjøres ved å skrive «:» i søkefeltet og trykke på valget', async ({ page, isMobile }) => {
    await openNote(page, 'lesekomfort/Kvartalsrapport');
    if (isMobile) await page.getByRole('button', { name: /^Søk/ }).first().tap();
    else await page.getByRole('button', { name: 'Søk i notater' }).click();
    await palettInput(page).fill(':diskret');
    const valg = palett(page).getByRole('option').first();
    if (isMobile) await valg.tap();
    else await valg.click();
    await expect(artikkel(page).getByText('Innebygd fra', { exact: true })).toHaveCount(0);
  });
});

test.describe('AK-1.1-07 hurtigtastoversikt', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur testes på desktop');

  test.fixme('TC-07-01 ? åpner oversikten, gruppert i riktig rekkefølge', async ({ page }) => {
    await openNote(page, 'Velkommen');
    const dialog = await åpneOversikt(page);
    await expect(dialog.getByRole('heading')).toHaveText([/Hurtigtaster/, ...fasit.tastaturkart.grupper]);
  });

  test.fixme('TC-07-02 alle bindinger fra tastaturkartet i spesifikasjonen er med', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    const vist = new Set((await raderIOversikt(page)).flatMap((r) => r.taster.map(normaliserVisning)));
    const mangler = fasit.tastaturkart.bindinger.map(normaliserVisning).filter((b) => !vist.has(b));
    expect(mangler).toEqual([]);
  });

  test.fixme('TC-07-03 lukkes med Esc og med ?', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    await page.keyboard.press('Escape');
    await expect(hurtigtastoversikt(page)).toBeHidden();
    await åpneOversikt(page);
    await page.keyboard.press('Shift+Slash');
    await expect(hurtigtastoversikt(page)).toBeHidden();
  });

  test.fixme('TC-07-04 ? på norsk tastatur (Shift + «+»-tasten) åpner oversikten', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await trykkNorsk(page, '?');
    await expect(hurtigtastoversikt(page)).toBeVisible();
  });

  test.fixme('TC-07-05 tilgjengelig fra Utseende', async ({ page }) => {
    await openNote(page, 'Velkommen');
    const dialog = await åpneUtseende(page);
    await dialog.getByRole('button', { name: 'Hurtigtaster' }).click();
    await expect(hurtigtastoversikt(page)).toBeVisible();
  });

  test.fixme('TC-07-06 snarveier vises plattformriktig (PO-36): «Ctrl K» utenfor macOS, aldri ⌘', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    await expect(hurtigtastoversikt(page)).not.toContainText('⌘');
    await expect(hurtigtastoversikt(page)).toContainText(/Ctrl\s*K/);
  });

  test.fixme('TC-07-07 innholdet er identisk med registeret', async ({ page }) => {
    const register = await lastRegister();
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    const rader = await raderIOversikt(page);
    const medTaster = register.kommandoer.filter((k) => k.bindings.some((b) => b.mode === 'normal'));
    expect(rader.map((r) => r.id).sort()).toEqual(medTaster.map((k) => k.id).sort());
    for (const k of medTaster) expect(rader.find((r) => r.id === k.id)?.navn, k.id).toBe(k.name);
  });

  test.fixme('TC-07-08 README-tabellen er generert og i sync med oversikten', async ({ page }) => {
    const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
    const m = /<!-- hurtigtaster:start -->([\s\S]*?)<!-- hurtigtaster:end -->/.exec(readme);
    expect(m, 'README har markørene <!-- hurtigtaster:start/end --> (npm run docs:shortcuts)').not.toBeNull();
    const tabell = m?.[1] ?? '';
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    const rader = await raderIOversikt(page);
    const tabellrader = tabell.split('\n').filter((l) => /^\|.*\|\s*$/.test(l) && !/^\|\s*-/.test(l));
    expect(tabellrader.length - 1, 'én rad per kommando (+ overskriftsrad)').toBe(rader.length);
    for (const rad of rader) expect(tabell, rad.navn).toContain(rad.navn);
  });
});
