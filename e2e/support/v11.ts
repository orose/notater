// Felles hjelpere for v1.1-akseptansetestene (docs/test/testplan-v1.1.md).
// Selektorene her er kontrakten mot frontend (testplanen §6): rolle + navn der spesifikasjonen gir dem,
// ellers `data-testid`. Endres en selektor, endres testplanen i samme commit.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { REPO } from './real-server';

// ---------------------------------------------------------------------------------------------
// Fasit (docs/test/v1.1-fasit.json, speiler test-vault/README-QA.md §19)
// ---------------------------------------------------------------------------------------------

interface Seksjon {
  readonly overskrift: string;
  readonly nivå: number;
  readonly skjuler: readonly string[];
  readonly beholder: readonly string[];
}

export interface V11Fasit {
  readonly rapport: {
    readonly sti: string;
    readonly tittel: string;
    readonly normal: { readonly toc: readonly string[]; readonly paragrafer: readonly string[]; readonly antallRammer: number };
    readonly diskret: {
      readonly overskrifter: readonly (readonly [number, string])[];
      readonly toc: readonly string[];
      readonly paragrafer: readonly string[];
      readonly kilder: Readonly<Record<string, string>>;
      readonly feilkort: readonly string[];
      readonly aldriSynlig: readonly string[];
    };
    readonly uendret: { readonly baseRader: number; readonly bilde: string };
  };
  readonly dypStruktur: {
    readonly sti: string;
    readonly tittel: string;
    readonly toc: readonly string[];
    readonly seksjoner: readonly Seksjon[];
    readonly dyplenke: { readonly lenketekst: string; readonly mål: string; readonly måUtfoldes: readonly string[]; readonly forblirFoldet: readonly string[] };
    readonly søk: { readonly ord: string; readonly mål: string };
  };
  readonly langBrodtekst: { readonly sti: string; readonly tittel: string; readonly lenkeTil: string; readonly minstBredereFullPx: number };
  readonly tastaturkart: { readonly bindinger: readonly string[]; readonly grupper: readonly string[]; readonly leaderHint: readonly string[] };
}

export const fasit = JSON.parse(readFileSync(join(REPO, 'docs/test/v1.1-fasit.json'), 'utf8')) as V11Fasit;

// ---------------------------------------------------------------------------------------------
// Selektorer (testplanen §6)
// ---------------------------------------------------------------------------------------------

export const artikkel = (page: Page): Locator => page.locator('main article').first();
export const sidepanel = (page: Page): Locator => page.getByRole('navigation', { name: 'Vault', exact: true });
export const høyremarg = (page: Page): Locator => page.getByRole('complementary', { name: 'På denne siden' });
export const tocNav = (page: Page): Locator => page.getByRole('navigation', { name: 'Innhold', exact: true });
export const palett = (page: Page): Locator => page.locator('dialog[open]').filter({ has: page.getByRole('combobox') });
export const palettInput = (page: Page): Locator => palett(page).getByRole('combobox');
export const hurtigtastoversikt = (page: Page): Locator => page.getByRole('dialog', { name: 'Hurtigtaster' });
export const utseende = (page: Page): Locator => page.getByRole('dialog', { name: 'Utseende' });
export const leaderHint = (page: Page): Locator => page.getByTestId('leader-hint');
export const toast = (page: Page): Locator => page.getByRole('status').filter({ hasText: /Diskré embedding/i });

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** F3: «Fold sammen ‹overskrift›» (utfoldet) / «Fold ut ‹overskrift›» (foldet, se Q-06). Eksakt match. */
export const foldKnapp = (page: Page, overskrift: string, scope?: Locator): Locator =>
  (scope ?? page).getByRole('button', { name: new RegExp(`^Fold (sammen|ut) «?${escapeRegex(overskrift)}»?$`) });

/** F2: kildelenken i en diskré embed (vises ved hover/fokus). */
export const kildelenke = (page: Page, tittel: string): Locator => page.getByRole('link', { name: `Kilde: ${tittel}`, exact: true });

/**
 * Overskrift i artikkelen med eksakt tekst. Tilgjengelig navn inneholder også #-ankerets og fold-knappens
 * navn, så vi matcher på tekstinnholdet: «Seksjon A.1» treffer ikke «Seksjon A.1.1».
 */
export const overskrift = (page: Page, tekst: string): Locator =>
  artikkel(page)
    .locator('h1, h2, h3, h4, h5, h6')
    .filter({ hasText: new RegExp(`^[^\\p{L}\\p{N}]*${escapeRegex(tekst)}(?![\\p{L}\\p{N}.])`, 'u') });

// ---------------------------------------------------------------------------------------------
// Tastatur
// ---------------------------------------------------------------------------------------------

/** Visningsnormalisering for tastekombinasjoner (se fasit.tastaturkart): «Space w» = «␣ w» = «Mellomrom+w». */
export function normaliserVisning(s: string): string {
  return s
    .replace(/Mellomrom|Space|␣/gi, '␣')
    .replace(/Control|⌃/g, 'Ctrl')
    .replace(/[\s+]/g, '');
}

/** Trykker en sekvens tast for tast: `trykkSekvens(page, ['Space', 'w'])`, `['z', 'a']`, `['g', 'g']`. */
export async function trykkSekvens(page: Page, taster: readonly string[], pauseMs = 40): Promise<void> {
  for (const tast of taster) {
    await page.keyboard.press(tast);
    if (pauseMs > 0) await page.waitForTimeout(pauseMs);
  }
}

/**
 * Norsk tastatur (P5): `:` = Shift+. , `?` = Shift++ , `/` = Shift+7 . Playwright bruker US-layout, så
 * vi sender ekte (trusted) tastehendelser via CDP med norsk `code` + Shift. Bare Chromium.
 */
const NORSK: Record<string, { readonly code: string; readonly vk: number }> = {
  ':': { code: 'Period', vk: 190 },
  '?': { code: 'Minus', vk: 187 },
  '/': { code: 'Digit7', vk: 55 },
  ';': { code: 'Comma', vk: 188 },
};

export async function trykkNorsk(page: Page, tegn: keyof typeof NORSK | string): Promise<void> {
  const def = NORSK[tegn];
  if (!def) throw new Error(`Ukjent norsk tegn: ${tegn}`);
  const cdp = await page.context().newCDPSession(page);
  const shift = 8;
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: shift, key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: shift, key: tegn, code: def.code, windowsVirtualKeyCode: def.vk, text: tegn, unmodifiedText: tegn });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: shift, key: tegn, code: def.code, windowsVirtualKeyCode: def.vk });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 0, key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  await cdp.detach();
}

/** Fjerner fokus fra alt interaktivt (hurtigtaster i normal-modus forutsetter fokus på body/innhold). */
export async function fokusPåInnhold(page: Page): Promise<void> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();
  });
}

// ---------------------------------------------------------------------------------------------
// Måling
// ---------------------------------------------------------------------------------------------

export const scrollY = (page: Page): Promise<number> => page.evaluate(() => Math.round(window.scrollY));

export const harHorisontalScroll = (page: Page): Promise<boolean> =>
  page.evaluate(() => (document.scrollingElement?.scrollWidth ?? 0) > window.innerWidth + 1);

/** Bredden på brødteksten (første avsnitt i artikkelen). */
export async function brødtekstBredde(page: Page): Promise<number> {
  const box = await artikkel(page).locator('p').first().boundingBox();
  if (!box) throw new Error('Fant ikke brødtekst');
  return box.width;
}

/** Effektiv opasitet (produktet opp gjennom treet) – Playwright regner opacity 0 som «synlig». */
export async function effektivOpasitet(loc: Locator): Promise<number> {
  return loc.evaluate((el) => {
    let o = 1;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.visibility === 'hidden' || s.display === 'none') return 0;
      o *= Number(s.opacity);
    }
    return o;
  });
}

/** Synlig for brukeren: i DOM, ikke skjult, og effektiv opasitet > 0,3. */
export async function forventSynlig(loc: Locator): Promise<void> {
  await expect(loc).toBeVisible();
  await expect.poll(() => effektivOpasitet(loc)).toBeGreaterThan(0.3);
}

/** Usynlig for seende brukere: ikke i DOM, skjult, eller opasitet ~0. */
export async function forventUsynlig(loc: Locator): Promise<void> {
  await expect
    .poll(async () => ((await loc.count()) === 0 || !(await loc.first().isVisible()) ? 0 : effektivOpasitet(loc.first())))
    .toBeLessThan(0.05);
}

/** Overskriftene i artikkelen i DOM-rekkefølge: [nivå, tekst] (uten fold-knapp, #-anker og aria-hidden). */
export function overskrifterIArtikkel(page: Page): Promise<[number, string][]> {
  return artikkel(page).evaluate((root) =>
    [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .filter((h) => !h.closest('[aria-hidden="true"]'))
      .map((h) => {
        const kopi = h.cloneNode(true) as HTMLElement;
        kopi.querySelectorAll('button, .heading-anchor, [aria-hidden="true"], [data-testid="fold-indikator"]').forEach((n) => n.remove());
        return [Number(h.tagName.slice(1)), (kopi.textContent ?? '').replace(/\s+/g, ' ').trim()] as [number, string];
      }),
  );
}

/** TOC-tekstene (desktop: høyremargen). */
export async function tocTekster(page: Page): Promise<string[]> {
  return (await tocNav(page).getByRole('link').allInnerTexts()).map((t) => t.replace(/^§?\s*\d+\s*/, '').replace(/\s+/g, ' ').trim());
}

/**
 * §-nummerering: H2-ene i artikkelen som får «§» via ::before, i rekkefølge, og at ingen forfar mellom
 * H2 og artikkelen nullstiller telleren (ellers starter nummereringen på nytt inne i en embed).
 */
export function paragrafOverskrifter(page: Page): Promise<{ tekster: string[]; nullstillinger: string[] }> {
  return artikkel(page).evaluate((root) => {
    const tekster: string[] = [];
    const nullstillinger: string[] = [];
    for (const h of root.querySelectorAll('h2')) {
      const innhold = getComputedStyle(h, '::before').content;
      if (!innhold.includes('§')) continue;
      const kopi = h.cloneNode(true) as HTMLElement;
      kopi.querySelectorAll('button, .heading-anchor, [aria-hidden="true"]').forEach((n) => n.remove());
      tekster.push((kopi.textContent ?? '').trim());
      for (let n = h.parentElement; n && n !== root; n = n.parentElement) {
        if (/\bsec\b/.test(getComputedStyle(n).counterReset)) nullstillinger.push(`${n.tagName}.${n.className} nullstiller sec før «${kopi.textContent}»`);
      }
    }
    return { tekster, nullstillinger };
  });
}

/** Ingen synlig ramme/bakgrunn rundt et tekststykke fra en embed (diskré modus, AK-1.1-03). */
export function rammerRundt(tekst: Locator): Promise<string[]> {
  return tekst.evaluate((el) => {
    const funn: string[] = [];
    const art = el.closest('article');
    const artBg = art ? getComputedStyle(art).backgroundColor : '';
    for (let n = el.parentElement; n && n !== art; n = n.parentElement) {
      const s = getComputedStyle(n);
      const kanter = ['Top', 'Right', 'Bottom', 'Left'].filter(
        (k) => parseFloat(s.getPropertyValue(`border-${k.toLowerCase()}-width`)) > 0 && s.getPropertyValue(`border-${k.toLowerCase()}-style`) !== 'none',
      );
      if (kanter.length > 0) funn.push(`${n.tagName}.${n.className}: kant ${kanter.join('/')}`);
      const bg = s.backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== artBg) funn.push(`${n.tagName}.${n.className}: bakgrunn ${bg}`);
      if (s.boxShadow !== 'none') funn.push(`${n.tagName}.${n.className}: skygge`);
    }
    return funn;
  });
}

// ---------------------------------------------------------------------------------------------
// Handlinger med mus (P6) – virker på desktop og mobil
// ---------------------------------------------------------------------------------------------

export async function åpneUtseende(page: Page): Promise<Locator> {
  const knapp = page.getByRole('button', { name: 'Utseende' });
  if (!(await knapp.first().isVisible())) {
    const meny = page.getByRole('button', { name: 'Åpne navigasjon' });
    if (await meny.isVisible()) await meny.click();
  }
  await page.getByRole('button', { name: 'Utseende' }).filter({ visible: true }).first().click();
  const dialog = utseende(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function lukkDialog(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}

/** F1 via Utseende. */
export async function velgLesebredde(page: Page, valg: 'Leseoptimalisert' | 'Full bredde'): Promise<void> {
  const dialog = await åpneUtseende(page);
  await dialog.getByRole('radio', { name: valg }).check();
  await lukkDialog(page);
}

/** F2 via Utseende (kontrollen gjelder bare det åpne notatet). */
export async function settDiskret(page: Page, på: boolean): Promise<void> {
  const dialog = await åpneUtseende(page);
  const kontroll = dialog.getByLabel('Diskré embedding – dette notatet');
  if ((await kontroll.isChecked()) !== på) await kontroll.click();
  await expect(kontroll).toBeChecked({ checked: på });
  await lukkDialog(page);
}

/** F5: åpner paletten med `:` og kjører første kommando som matcher `søk` (uten `:`). */
export async function kjørKommando(page: Page, søk: string): Promise<void> {
  await fokusPåInnhold(page);
  await page.keyboard.press(':');
  await expect(palettInput(page)).toBeFocused();
  await expect(palettInput(page)).toHaveValue(':');
  await palettInput(page).pressSequentially(søk);
  await expect(palett(page).getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
}

/** Sannhetsverdien for zen: begge panelene skjult (desktop) / topplinjen skjult (mobil). */
export async function erZen(page: Page, isMobile: boolean): Promise<boolean> {
  if (isMobile) return !(await page.getByRole('banner').isVisible());
  return !(await sidepanel(page).isVisible()) && !(await høyremarg(page).isVisible());
}
