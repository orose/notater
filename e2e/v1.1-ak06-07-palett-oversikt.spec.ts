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

/** Én kommando i `?`-kortet: id, tastealternativene (én streng per `hurtigtast-binding`) og radens etikett. */
interface KortKommando {
  readonly id: string;
  readonly taster: string[];
  /** Etiketten på raden kommandoen står i; i en par-rad felles («Rull ned / opp», PO-69). */
  readonly radnavn: string;
  /** Antall kommandoer i raden (1 = enkel rad, 2 = par-rad). */
  readonly iRaden: number;
}

interface Kort {
  readonly rader: { readonly navn: string; readonly ider: string[] }[];
  readonly kommandoer: KortKommando[];
  readonly tips: string[];
}

/**
 * Leser `?`-kortet (testplanen §6, PO-69). Radene har `data-testid="hurtigtast-rad"`; en rad kan være en
 * par-rad med flere kommandoer. Hver kommando har `data-command-id` på raden selv (enkel rad) eller på et
 * element inne i raden (par-rad). Hvert tastealternativ står i `data-testid="hurtigtast-binding"` med én
 * `<kbd>` per akkord. Tasthint-rader (komponentenes egne taster) har `data-testid="hurtigtast-tips"`.
 */
async function lesKort(page: Page): Promise<Kort> {
  return hurtigtastoversikt(page).evaluate((dialog) => {
    const kbdTekst = (el: Element) => [...el.querySelectorAll('kbd')].map((k) => (k.textContent ?? '').trim()).join(' ');
    const rader: { navn: string; ider: string[] }[] = [];
    const kommandoer: { id: string; taster: string[]; radnavn: string; iRaden: number }[] = [];
    for (const rad of dialog.querySelectorAll('[data-testid="hurtigtast-rad"]')) {
      const navnEl = rad.querySelector('[data-testid="hurtigtast-navn"]') ?? rad.querySelector('dd');
      const radnavn = (navnEl?.textContent ?? '').replace(/\s+/g, ' ').trim();
      const indre = [...rad.querySelectorAll('[data-command-id]')];
      const eiere = indre.length > 0 ? indre : rad.hasAttribute('data-command-id') ? [rad] : [];
      const ider = eiere.map((e) => e.getAttribute('data-command-id') ?? '');
      rader.push({ navn: radnavn, ider });
      for (const eier of eiere) {
        const bindinger = eier.matches('[data-testid="hurtigtast-binding"]') ? [eier] : [...eier.querySelectorAll('[data-testid="hurtigtast-binding"]')];
        const taster = (bindinger.length > 0 ? bindinger : [eier]).map(kbdTekst).filter((t) => t !== '');
        kommandoer.push({ id: eier.getAttribute('data-command-id') ?? '', taster, radnavn, iRaden: eiere.length });
      }
    }
    const tips = [...dialog.querySelectorAll('[data-testid="hurtigtast-tips"]')].map((t) => (t.textContent ?? '').replace(/\s+/g, ' ').trim());
    return { rader, kommandoer, tips };
  });
}

async function åpneOversikt(page: Page): Promise<Locator> {
  await fokusPåInnhold(page);
  await page.keyboard.press('Shift+Slash'); // «?» på US-layout; norsk: se TC-07-04
  await expect(hurtigtastoversikt(page)).toBeVisible();
  return hurtigtastoversikt(page);
}

test.describe('AK-1.1-06 én palett for søk og kommandoer', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur testes på desktop; mus/touch i TC-06-11');

  test('TC-06-01 ⌘K/Ctrl K gir tomt notatsøk', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palettInput(page)).toBeFocused();
    await expect(palettInput(page)).toHaveValue('');
    await palettInput(page).fill('kafka grunn');
    await expect(palett(page).getByRole('option').first()).toContainText('Kafka-grunnleggende');
  });

  test('TC-06-02 / gir tomt notatsøk (uten at «/» havner i feltet)', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await page.keyboard.press('/');
    await expect(palettInput(page)).toBeFocused();
    await expect(palettInput(page)).toHaveValue('');
  });

  test('TC-06-03 : gir kommandomodus, forhåndsutfylt med «:», og kommandoene viser hurtigtasten sin', async ({ page }) => {
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

  test('TC-06-04 Backspace over «:» går tilbake til notatsøk', async ({ page }) => {
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
  // Slice 1.1-a: tema, palett, modus og hjelp. Zen/bredde (1.1-b), folding (1.1-c) og diskré (1.1-d) kommer.
  const levert = new Set(['tema terminal', 'palett fosfor', 'mørk', 'hjelp', 'taster']);
  for (const [søk, sti, forvent] of effekter) {
    (levert.has(søk) ? test : test.fixme)(`TC-06-05 :${søk} kjører kommandoen`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await openNote(page, sti);
      await kjørKommando(page, søk);
      await forvent(page);
    });
  }

  test('TC-06-06 :lys etter :mørk gir lys modus', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openNote(page, 'Velkommen');
    await kjørKommando(page, 'lys');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  });

  test('TC-06-07 kommandoer med argument tilbyr verdiene som underliste (:tema)', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await page.keyboard.press(':');
    await palettInput(page).pressSequentially('tema ');
    for (const navn of ['Tidsskrift', 'Terminal', 'Klartekst']) await expect(palett(page).getByRole('option', { name: new RegExp(navn) })).toBeVisible();
    await palettInput(page).pressSequentially('kla');
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-type', 'klartekst');
  });

  test('TC-06-08 kontekstløse kommandoer er deaktivert med forklaring (:diskret på .base)', async ({ page }) => {
    await openNote(page, 'Oppgaver.base');
    await fokusPåInnhold(page);
    await page.keyboard.press(':');
    await palettInput(page).pressSequentially('diskret');
    const valg = palett(page).getByRole('option').first();
    await expect(valg).toHaveAttribute('aria-disabled', 'true');
    await expect(valg).toContainText(/ikke tilgjengelig|bare|kun/i);
  });

  test('TC-06-09 alle kommandoer i oversikten finnes i paletten med sin primære hurtigtast (PO-69)', async ({ page }) => {
    const register = (await lastRegister()).kommandoer;
    const navn = new Map(register.map((k) => [k.id, k.name]));
    // Primær hurtigtast = første normal-binding i registeret (Leader → Space, Mod → Ctrl utenfor macOS).
    const primær = new Map(
      register.map((k) => [k.id, normaliserVisning((k.bindings.find((b) => b.mode === 'normal')?.raw ?? '').replace(/Leader/g, 'Space').replace(/Mod\+/g, 'Ctrl+')).toLowerCase()]),
    );
    await openNote(page, 'lesekomfort/Kvartalsrapport');
    await åpneOversikt(page);
    const { kommandoer } = await lesKort(page);
    expect(kommandoer.length).toBeGreaterThan(10);
    await page.keyboard.press('Escape');
    // Kommandoer som ikke vises i paletten (inPalette: false – Esc og «:»)
    const ikkeIPaletten = new Set(['system.escape', 'palette.commands']);
    for (const k of kommandoer.filter((x) => !ikkeIPaletten.has(x.id))) {
      const kommandonavn = navn.get(k.id) ?? '';
      expect(kommandonavn, `${k.id} finnes i registeret`).not.toBe('');
      await fokusPåInnhold(page);
      await page.keyboard.press(':');
      await palettInput(page).pressSequentially(kommandonavn);
      const valg = palett(page).locator(`[role="option"][data-command-id="${k.id}"]`);
      await expect(valg, k.id).toBeVisible();
      const vist = normaliserVisning((await valg.locator('kbd').allInnerTexts()).join(' '));
      expect(k.taster.map(normaliserVisning), `${k.id}: palettens tast står også i kortet`).toContain(vist);
      expect(vist.toLowerCase(), `${k.id}: paletten viser kun primær hurtigtast (PO-69)`).toBe(primær.get(k.id));
      await page.keyboard.press('Escape');
    }
  });

  test('TC-06-10 Esc lukker paletten og returnerer fokus', async ({ page }) => {
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

  test('TC-07-01 ? åpner oversikten, gruppert i riktig rekkefølge', async ({ page }) => {
    await openNote(page, 'Velkommen');
    const dialog = await åpneOversikt(page);
    await expect(dialog.getByRole('heading')).toHaveText([/Hurtigtaster/, ...fasit.tastaturkart.grupper]);
  });

  test('TC-07-02 alle bindinger fra tastaturkartet i spesifikasjonen er med', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    const vist = new Set((await lesKort(page)).kommandoer.flatMap((k) => k.taster.map(normaliserVisning)));
    const mangler = fasit.tastaturkart.bindinger.map(normaliserVisning).filter((b) => !vist.has(b));
    expect(mangler).toEqual([]);
  });

  test('TC-07-03 lukkes med Esc og med ?', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    await page.keyboard.press('Escape');
    await expect(hurtigtastoversikt(page)).toBeHidden();
    await åpneOversikt(page);
    await page.keyboard.press('Shift+Slash');
    await expect(hurtigtastoversikt(page)).toBeHidden();
  });

  test('TC-07-04 ? på norsk tastatur (Shift + «+»-tasten) åpner oversikten', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await trykkNorsk(page, '?');
    await expect(hurtigtastoversikt(page)).toBeVisible();
  });

  test('TC-07-05 tilgjengelig fra Utseende', async ({ page }) => {
    await openNote(page, 'Velkommen');
    const dialog = await åpneUtseende(page);
    await dialog.getByRole('button', { name: 'Hurtigtaster' }).click();
    await expect(hurtigtastoversikt(page)).toBeVisible();
  });

  test('TC-07-06 snarveier vises plattformriktig (PO-36): «Ctrl K» utenfor macOS, aldri ⌘', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    await expect(hurtigtastoversikt(page)).not.toContainText('⌘');
    await expect(hurtigtastoversikt(page)).toContainText(/Ctrl\s*K/);
  });

  test('TC-07-07 innholdet er identisk med registeret (kommandoer, taster, tips)', async ({ page }) => {
    const register = await lastRegister();
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    const kort = await lesKort(page);
    const medTaster = register.kommandoer.filter((k) => k.bindings.some((b) => b.mode === 'normal'));
    // Hver kommando med taster står nøyaktig én gang (par-rader teller begge), ingen ukjente id-er.
    expect(kort.kommandoer.map((k) => k.id).sort()).toEqual(medTaster.map((k) => k.id).sort());
    for (const k of medTaster) {
      const vist = kort.kommandoer.find((x) => x.id === k.id);
      expect(vist?.taster.length, `${k.id}: alle tastealternativer vises`).toBe(k.bindings.filter((b) => b.mode === 'normal').length);
      // Enkel rad: etiketten er kommandonavnet. Par-rad: felles etikett (PO-69), ikke tom.
      if (vist?.iRaden === 1) expect(vist.radnavn, k.id).toBe(k.name);
      else expect(vist?.radnavn, k.id).not.toBe('');
    }
    expect(kort.rader.every((r) => r.ider.length >= 1 && r.ider.length <= 2), 'rader har 1 eller 2 kommandoer').toBe(true);
    expect(kort.tips.length, 'tasthint (KEY_HINTS) som egne rader').toBe(register.tips.length);
  });

  test('TC-07-08 README-tabellen er generert og i sync med oversikten', async ({ page }) => {
    const readme = readFileSync(join(REPO, 'README.md'), 'utf8');
    const m = /<!-- hurtigtaster:start -->([\s\S]*?)<!-- hurtigtaster:end -->/.exec(readme);
    expect(m, 'README har markørene <!-- hurtigtaster:start/end --> (npm run docs:shortcuts)').not.toBeNull();
    const avsnitt = m?.[1] ?? '';
    const tabellrader = avsnitt.split('\n').filter((l) => /^\|.*\|\s*$/.test(l) && !/^\|\s*-/.test(l)).slice(1);
    await openNote(page, 'Velkommen');
    await åpneOversikt(page);
    const kort = await lesKort(page);
    // README kan ha én rad per kommando eller følge par-radene i kortet (PO-69).
    expect([kort.kommandoer.length, kort.rader.length], 'antall tabellrader').toContain(tabellrader.length);
    const tabell = normaliserVisning(tabellrader.join('\n').replace(/`/g, ''));
    for (const rad of kort.rader) expect(avsnitt, `etikett: ${rad.navn}`).toContain(rad.navn);
    for (const k of kort.kommandoer) for (const t of k.taster) expect(tabell, `${k.id}: ${t}`).toContain(normaliserVisning(t));
    expect(avsnitt.split('\n').filter((l) => /^\s*-\s/.test(l)).length, 'tasthint som punktliste').toBe(kort.tips.length);
  });
});
