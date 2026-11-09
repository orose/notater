// Felles hjelpere for v2-akseptansetestene (presentasjonsmodus, docs/test/testplan-v2.md).
// Selektorene her er kontrakten mot frontend (testplanen §6): rolle + navn der spesifikasjonen gir dem,
// ellers `data-testid`. Endres en selektor, endres testplanen i samme commit.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, relative } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import { copyTestVault, makeTempDir, removeDir, REPO, startServer, writeConfig } from './real-server';
import { test as base, noteUrl, openNote } from './guards';
import { fokusPåInnhold, kjørKommando, trykkSekvens } from './v11';

// ---------------------------------------------------------------------------------------------
// Fasit (docs/test/v2-fasit.json, speiler test-vault/README-QA.md §20)
// ---------------------------------------------------------------------------------------------

export type LysbildeType = 'tittel' | 'agenda' | 'overgang' | 'innhold';

export interface FasitLysbilde {
  readonly type: LysbildeType;
  readonly overskrift: string | null;
  readonly agendapunkt?: string | null;
  readonly progresjon?: string | null;
  readonly inneholder?: readonly string[];
  readonly kode?: boolean;
  readonly tabell?: boolean;
  readonly mermaid?: boolean;
  readonly internRulling?: boolean;
  readonly skaleres?: boolean;
  readonly fotnote?: string;
  readonly base?: {
    readonly type: string;
    readonly kort: number;
    readonly kolonner: number;
    readonly embed: string;
    readonly view: string;
    readonly liveKort: string;
    readonly liveFil: string;
    readonly fra: string;
    readonly til: string;
  };
  readonly avklaring?: string;
}

export interface FasitNotat {
  readonly sti: string;
  readonly tittel?: string;
  readonly agenda?: readonly string[];
  readonly lysbilder: readonly FasitLysbilde[];
}

export interface V2Fasit {
  readonly forts: string;
  readonly statusmote: FasitNotat & {
    readonly tittellysbilde: { readonly ingress: string; readonly properties: readonly string[]; readonly skjult: readonly string[]; readonly endret: string };
    readonly startFraSeksjon: Readonly<Record<string, number>>;
    readonly live: {
      readonly agendaFra: string;
      readonly agendaTil: string;
      readonly slettSeksjon: string;
      readonly etterSletting: { readonly type: LysbildeType; readonly agendapunkt: string; readonly n: number; readonly av: number };
    };
    /** ADR-010 §4: `?lysbilde=<id>` → lysbildenummer. */
    readonly urlIder: Readonly<Record<string, number>>;
    readonly lenke: { readonly lysbilde: number; readonly tekst: string; readonly mål: string };
  };
  readonly rapport: FasitNotat & { readonly aldriSynlig: readonly string[] };
  readonly delte: FasitNotat & { readonly urlIder: Readonly<Record<string, number>> };
  readonly ukjentUrlId: { readonly id: string; readonly gir: number };
  readonly tagger: { readonly sti: string; readonly tagg: string };
  readonly mye: {
    readonly sti: string;
    readonly agenda: readonly string[];
    readonly overskrift: string;
    readonly minstDeler: number;
    readonly markorer: readonly string[];
    readonly listepunktPrefiks: string;
    readonly sisteLysbilde: FasitLysbilde;
  };
  readonly stor: FasitNotat;
  readonly uten: FasitNotat;
  readonly forKort: FasitNotat;
  readonly forLang: FasitNotat;
  readonly mange: FasitNotat & {
    readonly avkortet: Readonly<Record<string, { readonly synlige: readonly string[]; readonly før: boolean; readonly etter: boolean }>>;
    readonly avkortingViewport: { readonly width: number; readonly height: number };
  };
  readonly niva: {
    readonly sti: string;
    readonly h2: { readonly agenda: readonly string[]; readonly lysbilder: readonly FasitLysbilde[] };
    readonly h3: { readonly agenda: readonly string[]; readonly lysbilder: readonly FasitLysbilde[] };
    readonly h4: { readonly agenda: readonly string[]; readonly lysbilder: readonly FasitLysbilde[]; readonly ikkeLysbilde: readonly string[] };
    readonly ugyldige: readonly string[];
    readonly tomme: readonly string[];
    readonly feilkoder: { readonly ugyldig: string; readonly tomt: string };
    readonly tomIAnnetNotat: { readonly sti: string; readonly niva: string; readonly feilkode: string };
  };
  readonly lerret: {
    readonly forhold: number;
    readonly toleranse: number;
    readonly viewports: readonly { readonly width: number; readonly height: number }[];
    /** Logiske px (lerretet er 1920×1080 før `transform: scale`, ADR-010 §2; PO-86). */
    readonly typografi: {
      readonly logiskBredde: number;
      readonly logiskHoyde: number;
      readonly brodtekstPx: number;
      readonly minimumPx: number;
      readonly toleransePx: number;
    };
  };
  readonly taster: Readonly<Record<'start' | 'neste' | 'forrige' | 'forste' | 'siste' | 'oversikt' | 'svart' | 'fullskjerm' | 'palett' | 'hjelp' | 'avslutt', readonly string[]>> & {
    readonly presentModus: string;
    readonly nyeGrupper: readonly string[];
    readonly kommandoer: readonly string[];
  };
  readonly ytelse: { readonly lysbildebytteP95Ms: number; readonly startRapport20EmbedsMs: number };
}

export const fasit2 = JSON.parse(readFileSync(join(REPO, 'docs/test/v2-fasit.json'), 'utf8')) as V2Fasit;

// ---------------------------------------------------------------------------------------------
// Selektorer (testplanen §6)
// ---------------------------------------------------------------------------------------------

/** Presentasjonen: `role=region` «Presentasjon» (`aria-roledescription="lysbildeserie"`). */
export const presentasjon = (page: Page): Locator => page.getByRole('region', { name: 'Presentasjon', exact: true });
/** 16:9-lerretet. */
export const lerret = (page: Page): Locator => page.getByTestId('lerret');
/** Gjeldende lysbilde (bare ett er synlig): `data-testid="lysbilde"`, `data-slide-type`, `data-slide-index`. */
export const lysbilde = (page: Page): Locator => presentasjon(page).getByTestId('lysbilde').filter({ visible: true });
export const lysbildeOverskrift = (page: Page): Locator => lysbilde(page).getByTestId('lysbilde-overskrift');
export const lysbildeInnhold = (page: Page): Locator => lysbilde(page).getByTestId('lysbilde-innhold');
/** Agendalinjen øverst på innholdslysbilder: `<ol data-testid="agendalinje">`, gjeldende `aria-current="step"`. */
export const agendalinje = (page: Page): Locator => presentasjon(page).getByTestId('agendalinje');
export const agendaProgresjon = (page: Page): Locator => agendalinje(page).getByTestId('agenda-progresjon');
/** «…» før/etter i en avkortet agendalinje (`data-side="før"|"etter"`). */
export const agendaEllipse = (page: Page): Locator => agendalinje(page).getByTestId('agenda-ellipse');
/** Agendalisten på agenda- og overgangslysbilder: `<ol data-testid="agendaliste">`. */
export const agendaliste = (page: Page): Locator => lysbilde(page).getByTestId('agendaliste');
export const fremdrift = (page: Page): Locator => presentasjon(page).getByRole('progressbar', { name: 'Fremdrift' });
/** «7 / 12». */
export const lysbildenummer = (page: Page): Locator => presentasjon(page).getByTestId('lysbildenummer');
/** Skjermleserkunngjøring (`role=status`, `aria-live=polite`): «Lysbilde 7 av 12: Leveranse B». */
export const kunngjøring = (page: Page): Locator => page.getByTestId('lysbilde-kunngjoring');
export const oversikt = (page: Page): Locator => page.getByRole('dialog', { name: 'Lysbildeoversikt' });
export const oversiktLysbilder = (page: Page): Locator => oversikt(page).getByTestId('oversikt-lysbilde');
export const svartSkjerm = (page: Page): Locator => page.getByTestId('svart-skjerm');
/** Feilmelding med vim-stil feilkode (S4) i paletten. PO-101: E475 = ugyldig argument, E486 = nivået finnes ikke. */
export const feilkode = (page: Page, kode?: string): Locator => page.getByRole('status').filter({ hasText: kode ?? /E\d{3}/ });

export async function erIPresentasjon(page: Page): Promise<boolean> {
  return (await presentasjon(page).count()) > 0 && (await presentasjon(page).isVisible());
}

// ---------------------------------------------------------------------------------------------
// Start, avslutt og navigasjon
// ---------------------------------------------------------------------------------------------

/** Venter til presentasjonen er bygget og et lysbilde vises. */
export async function ventPåPresentasjon(page: Page): Promise<void> {
  await expect(presentasjon(page)).toBeVisible();
  await expect(lysbilde(page)).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-present', 'on');
}

/** Starter presentasjon fra gjeldende leseposisjon med `Space p` (standard) eller `:presenter [arg]`. */
export async function startPresentasjon(page: Page, via: 'leader' | 'kommando' = 'leader', argument = ''): Promise<void> {
  await fokusPåInnhold(page);
  if (via === 'leader') await trykkSekvens(page, ['Space', 'p']);
  else await kjørKommando(page, argument ? `presenter ${argument}` : 'presenter');
  await ventPåPresentasjon(page);
}

/** Åpner notatet og starter presentasjonen fra toppen (tittellysbildet). */
export async function presenter(page: Page, sti: string, argument = ''): Promise<void> {
  await openNote(page, sti);
  await page.evaluate(() => window.scrollTo(0, 0));
  await startPresentasjon(page, argument ? 'kommando' : 'leader', argument);
  await expect(lysbilde(page)).toHaveAttribute('data-slide-index', '1');
}

export async function avsluttPresentasjon(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(presentasjon(page)).toBeHidden();
  await expect(page.locator('html')).not.toHaveAttribute('data-present', 'on');
}

export async function nummer(page: Page): Promise<{ n: number; av: number }> {
  const tekst = (await lysbildenummer(page).innerText()).replace(/\s+/g, ' ').trim();
  const m = /(\d+)\s*\/\s*(\d+)/.exec(tekst);
  if (!m) throw new Error(`Forstår ikke lysbildenummeret «${tekst}»`);
  return { n: Number(m[1]), av: Number(m[2]) };
}

export async function ventPåLysbilde(page: Page, n: number): Promise<void> {
  await expect(lysbilde(page)).toHaveAttribute('data-slide-index', String(n));
}

/** Går til lysbilde `n` (1-basert) med `gg` + `j`. */
export async function gåTilLysbilde(page: Page, n: number): Promise<void> {
  await trykkSekvens(page, ['g', 'g']);
  await ventPåLysbilde(page, 1);
  for (let i = 1; i < n; i++) {
    await page.keyboard.press('j');
    await ventPåLysbilde(page, i + 1);
  }
}

/** Synlig tekst uten fold-knapper, #-ankre og aria-hidden. */
async function renTekst(loc: Locator): Promise<string> {
  return loc.evaluate((el) => {
    const kopi = el.cloneNode(true) as HTMLElement;
    kopi.querySelectorAll('button, .heading-anchor, [aria-hidden="true"]').forEach((n) => n.remove());
    return (kopi.textContent ?? '').replace(/\s+/g, ' ').trim();
  });
}

export interface LestLysbilde {
  readonly type: LysbildeType;
  readonly overskrift: string | null;
  readonly agendapunkt: string | null;
  readonly progresjon: string | null;
}

/** Leser gjeldende lysbilde slik brukeren ser det (sammenlignes med fasiten, se `somFasit`). */
export async function lesLysbilde(page: Page): Promise<LestLysbilde> {
  const el = lysbilde(page);
  const type = (await el.getAttribute('data-slide-type')) as LysbildeType;
  const h = el.getByTestId('lysbilde-overskrift');
  const overskrift = (await h.count()) > 0 ? await renTekst(h.first()) : null;
  let agendapunkt: string | null = null;
  let progresjon: string | null = null;
  if (type === 'innhold' && (await agendalinje(page).count()) > 0 && (await agendalinje(page).isVisible())) {
    const nå = agendalinje(page).locator('[aria-current="step"]');
    agendapunkt = (await nå.count()) > 0 ? (await renTekst(nå.first())).replace(/\s*\d+\s*\/\s*\d+$/, '') : null;
    progresjon = (await agendaProgresjon(page).count()) > 0 ? (await agendaProgresjon(page).innerText()).replace(/\s+/g, '') : null;
  }
  if (type === 'overgang') {
    const nå = agendaliste(page).locator('[aria-current="step"]');
    agendapunkt = (await nå.count()) > 0 ? await renTekst(nå.first()) : null;
  }
  return { type, overskrift, agendapunkt, progresjon };
}

/** Projiserer et fasitlysbilde til feltene `lesLysbilde` gir, per type. */
export function somFasit(l: FasitLysbilde): LestLysbilde {
  switch (l.type) {
    case 'tittel':
      return { type: 'tittel', overskrift: l.overskrift, agendapunkt: null, progresjon: null };
    case 'agenda':
      return { type: 'agenda', overskrift: null, agendapunkt: null, progresjon: null };
    case 'overgang':
      return { type: 'overgang', overskrift: null, agendapunkt: l.agendapunkt ?? null, progresjon: null };
    default:
      return { type: 'innhold', overskrift: l.overskrift, agendapunkt: l.agendapunkt ?? null, progresjon: l.progresjon ?? null };
  }
}

/** Samme projeksjon for et lest lysbilde (agenda/overgang: overskriften er pynt og sammenlignes ikke). */
export function somLest(l: LestLysbilde): LestLysbilde {
  return somFasit(l);
}

/** Går gjennom alle lysbildene fra første til siste med `j` og leser hvert. */
export async function lesAlleLysbilder(page: Page): Promise<LestLysbilde[]> {
  await trykkSekvens(page, ['g', 'g']);
  await ventPåLysbilde(page, 1);
  const { av } = await nummer(page);
  const ut: LestLysbilde[] = [];
  for (let i = 1; i <= av; i++) {
    await ventPåLysbilde(page, i);
    ut.push(somLest(await lesLysbilde(page)));
    if (i < av) await page.keyboard.press('j');
  }
  return ut;
}

/**
 * Setter leseposisjonen (leselinje 30 %, PO-53) til seksjonen som starter med overskriften `tekst`:
 * overskriftens topp legges like over leselinjen.
 */
export async function settLeseposisjon(page: Page, tekst: string): Promise<void> {
  const h = page.locator('main article').locator('h1, h2, h3, h4, h5, h6').filter({ hasText: tekst }).first();
  await expect(h).toBeVisible();
  await h.evaluate((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, top - window.innerHeight * 0.29));
  });
  await page.waitForTimeout(100);
}

/** Overskriften som står ved leselinjen (30 %) i lesevisningen. */
export function overskriftVedLeselinjen(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const linje = window.innerHeight * 0.3;
    const hs = [...document.querySelectorAll('main article h1, main article h2, main article h3, main article h4, main article h5, main article h6')];
    let funnet: Element | null = null;
    for (const h of hs) if (h.getBoundingClientRect().top <= linje + 1) funnet = h;
    if (!funnet) return null;
    const kopi = funnet.cloneNode(true) as HTMLElement;
    kopi.querySelectorAll('button, .heading-anchor, [aria-hidden="true"]').forEach((n) => n.remove());
    return (kopi.textContent ?? '').replace(/\s+/g, ' ').trim();
  });
}

// ---------------------------------------------------------------------------------------------
// Måling
// ---------------------------------------------------------------------------------------------

export interface Boks {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export async function boks(loc: Locator): Promise<Boks> {
  const b = await loc.boundingBox();
  if (!b) throw new Error('Elementet har ingen boks');
  return b;
}

/** Lerretet er 16:9 (± toleranse), ligger helt innenfor vinduet og fyller det i minst én retning (letterbox). */
export async function forventLerret169(page: Page): Promise<void> {
  const b = await boks(lerret(page));
  const vp = page.viewportSize();
  if (!vp) throw new Error('Mangler viewport');
  expect(Math.abs(b.width / b.height - fasit2.lerret.forhold) / fasit2.lerret.forhold, `forhold ${b.width}×${b.height}`).toBeLessThan(fasit2.lerret.toleranse);
  expect(b.x).toBeGreaterThanOrEqual(-1);
  expect(b.y).toBeGreaterThanOrEqual(-1);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 1);
  expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 1);
  const fyllerBredde = Math.abs(b.width - vp.width) <= 2;
  const fyllerHøyde = Math.abs(b.height - vp.height) <= 2;
  expect(fyllerBredde || fyllerHøyde, `lerretet fyller vinduet i én retning (${b.width}×${b.height} i ${vp.width}×${vp.height})`).toBe(true);
}

/**
 * «Ingen innhold kuttes usynlig» (AK-2-08): alle blokker i lysbildets innhold ligger innenfor lerretet, og
 * innholdsflaten flyter ikke over. Unntak: elementer med intern rulling (overflow auto/scroll), som er
 * siste utvei for kode/tabell (A2). Returnerer en liste med brudd.
 */
export function kuttetInnhold(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const brudd: string[] = [];
    const lerret = document.querySelector('[data-testid="lerret"]');
    const innhold = [...document.querySelectorAll('[data-testid="lysbilde"]')].find((el) => (el as HTMLElement).offsetParent !== null)?.querySelector('[data-testid="lysbilde-innhold"]');
    if (!lerret || !innhold) return ['fant ikke lerret/innhold'];
    const L = lerret.getBoundingClientRect();
    const ruller = (el: Element) => /(auto|scroll)/.test(getComputedStyle(el).overflowY + getComputedStyle(el).overflowX);
    if (innhold.scrollHeight > innhold.clientHeight + 1 && !ruller(innhold)) brudd.push(`innholdsflaten flyter over (${innhold.scrollHeight} > ${innhold.clientHeight})`);
    for (const blokk of [...innhold.children]) {
      const r = blokk.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.top < L.top - 1 || r.bottom > L.bottom + 1 || r.left < L.left - 1 || r.right > L.right + 1) {
        brudd.push(`${blokk.tagName.toLowerCase()} «${(blokk.textContent ?? '').slice(0, 40)}» utenfor lerretet`);
      }
    }
    return brudd;
  });
}

/**
 * Minste beregnede skriftstørrelse for tekst i lysbildets innhold, i **logiske** px: lerretet er 1920×1080 og
 * skaleres med `transform` (ADR-010 §2), så `getComputedStyle().fontSize` er uavhengig av vindusstørrelsen.
 */
export function minsteSkrift(page: Page): Promise<number> {
  return lysbildeInnhold(page).evaluate((root) => {
    let min = Infinity;
    const gå = (el: Element) => {
      const harTekst = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
      if (harTekst && (el as HTMLElement).offsetParent !== null) min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
      for (const c of el.children) gå(c);
    };
    gå(root);
    return min;
  });
}

export const p95 = (xs: readonly number[]): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(xs.length * 0.95) - 1)]!;
export const median = (xs: readonly number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/** Sjekksum (innhold + mtime) av alle filer under `mappe` i vault-kopien (P1: ingenting skrives). */
export function sjekksum(vaultDir: string, mappe = 'presentasjon'): Record<string, string> {
  const ut: Record<string, string> = {};
  const gå = (dir: string) => {
    for (const navn of readdirSync(dir)) {
      const fil = join(dir, navn);
      const st = statSync(fil);
      if (st.isDirectory()) gå(fil);
      else ut[relative(vaultDir, fil)] = `${createHash('sha256').update(readFileSync(fil)).digest('hex')}@${st.mtimeMs}`;
    }
  };
  gå(join(vaultDir, mappe));
  return ut;
}

// ---------------------------------------------------------------------------------------------
// Egen vault-kopi og server per test (live-endringer under presentasjon, PO-76-mønsteret fra ak12)
// ---------------------------------------------------------------------------------------------

function ledigPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export interface Live {
  /** Vault-kopien bare denne testen bruker. */
  readonly vault: string;
  /** `http://127.0.0.1:<port>` for testens egen server. */
  readonly base: string;
  /** URL til et notat på testens server. */
  url(sti: string): string;
}

/** `test` med fixturen `live`: egen vault-kopi og egen server, så endringer ikke lekker til andre tester. */
export const liveTest = base.extend<{ live: Live }>({
  live: async ({ page }, use) => {
    const dir = makeTempDir('vault-leser-e2e-v2live-');
    const vault = copyTestVault(dir);
    let server: Awaited<ReturnType<typeof startServer>> | undefined;
    for (let forsøk = 0; !server; forsøk++) {
      const port = await ledigPort();
      try {
        server = await startServer(process.env.E2E_TMP_DIR!, writeConfig(dir, vault, port), port);
      } catch (error) {
        if (forsøk >= 2) throw error;
      }
    }
    const baseUrl = `http://127.0.0.1:${server.port}`;
    await use({ vault, base: baseUrl, url: (sti: string) => `${baseUrl}${noteUrl(sti)}` });
    // Lukk SSE-strømmen før serveren stoppes (ellers ERR_INCOMPLETE_CHUNKED_ENCODING i konsollen).
    await page.goto('about:blank');
    await server.stop();
    removeDir(dir);
  },
});
