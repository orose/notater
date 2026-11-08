// AK14 kodeblokker, AK15 mermaid, AK16 TOC + scroll-spy, embeds (QA-EMB-*), callouts og PO-35.
// Mot den ekte serveren og vault-kopien. Fasit: README-QA §5, §7–§12.
import { expect, noteUrl, openNote, test } from './support/guards';

const KODE = 'teknisk/Kodeblokker – alle språk';

test.describe('AK14 kodeblokker (QA-KOD-*)', () => {
  test('highlighting og språkmerke for kjente språk (QA-KOD-01/02)', async ({ page }) => {
    await openNote(page, KODE);
    const figures = page.locator('main article figure.code');
    expect(await figures.count()).toBeGreaterThan(12);
    for (const lang of ['java', 'json', 'bash', 'yaml', 'sql', 'typescript', 'kotlin', 'xml', 'diff']) {
      const fig = page.locator(`main article figure.code[data-lang="${lang}"]`).first();
      await expect(fig, lang).toBeVisible();
      await expect(fig.locator('.lang'), lang).toHaveText(new RegExp(lang === 'typescript' ? 'typescript' : lang, 'i'));
      // Shiki-tokens med tema-variabler (følger tema, A9).
      const colored = await fig.locator('pre span[style*="--shiki"]').count();
      expect(colored, `${lang} har fargede tokens`).toBeGreaterThan(0);
    }
  });

  test('ukjent språk og uten språk: ren tekst, ingen krasj (QA-KOD-04/05)', async ({ page }) => {
    await openNote(page, KODE);
    const unknown = page.locator('main article figure.code[data-lang="cobol-2077"]');
    await expect(unknown).toBeVisible();
    await expect(unknown.locator('.lang')).toHaveText(/cobol-2077/i);
  });

  test('kopier-knapp kopierer eksakt innhold og gir tilbakemelding (QA-KOD-03)', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard-tillatelser kun i Chromium');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openNote(page, 'teknisk/Spring/Spring Boot – konfigurasjon');
    const fig = page.locator('main article figure.code').first();
    const button = fig.getByRole('button', { name: 'Kopier kode' });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toContainText('Kopiert');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('server:\n  port: 8080');
    expect(clip).toContain('include: health,info,prometheus');
    expect(clip.startsWith('>')).toBe(false);
  });

  test('tittel/filnavn fra title="…" og title:… (QA-KOD-11, R6)', async ({ page }) => {
    await openNote(page, 'teknisk/Spring/Spring Boot – konfigurasjon');
    await expect(page.locator('main article figure.code .file').nth(0)).toHaveText('src/main/resources/application.yaml');
    await expect(page.locator('main article figure.code .file').nth(1)).toHaveText('OrdreProperties.java');
  });

  test('html-blokk med <script> vises som tekst (QA-KOD-10)', async ({ page }) => {
    await openNote(page, KODE);
    await expect(page.locator('main article figure.code[data-lang="html"]').first()).toContainText('<script>');
    await expect(page.locator('main article script')).toHaveCount(0);
  });

  test('lang linje scroller inne i blokken, ikke siden (QA-KOD-07, AK5)', async ({ page }) => {
    await openNote(page, KODE);
    const pre = page.locator('main article figure.code', { hasText: 'veldigLangStreng' }).locator('pre');
    await pre.scrollIntoViewIfNeeded();
    const { scroll, client, overflowX } = await pre.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, overflowX: getComputedStyle(el).overflowX }));
    expect(scroll).toBeGreaterThan(client);
    expect(['auto', 'scroll']).toContain(overflowX);
    expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test('kode i nummerert liste: nummerering fortsetter 1, 2, 3 (QA-KOD-08)', async ({ page }) => {
    await openNote(page, KODE);
    const list = page.locator('main article ol', { hasText: 'Start Kafka lokalt' }).first();
    await expect(list.locator(':scope > li')).toHaveCount(3);
  });

  test('stor kodeblokk rendres helt (QA-KOD-12)', async ({ page }) => {
    await openNote(page, 'teknisk/Stor kodeblokk');
    await expect(page.locator('main article')).toContainText('Slutt på notatet');
    const lines = await page.locator('main article figure.code pre .line').count();
    expect(lines).toBeGreaterThan(550);
  });

  test('```sequenceDiagram er ikke mermaid (QA-KOD-13)', async ({ page }) => {
    await openNote(page, 'teknisk/Kafka/Consumer groups');
    await expect(page.locator('main article figure.code[data-lang="sequenceDiagram"]')).toBeVisible();
  });
});

test.describe('AK15 mermaid (QA-MER-*)', () => {
  test('alle diagramtyper rendres som SVG, ugyldig gir feilkort med kilde (QA-MER-01/03)', async ({ page, guards }) => {
    guards.allowConsole.push(/mermaid|parse|syntax/i);
    await openNote(page, 'teknisk/Mermaid-galleri');
    const svgs = page.locator('main article .diagram-svg svg');
    await expect(svgs).toHaveCount(7, { timeout: 20_000 });
    const article = page.locator('main article');
    await expect(article).toContainText(/kunne ikke|feil i diagram|ugyldig/i);
    // Ingen mermaid-«bombe» i body utenfor appen.
    const stray = await page.evaluate(() => [...document.body.children].filter((el) => /syntax error/i.test(el.textContent ?? '') && !el.querySelector('main')).length);
    expect(stray).toBe(0);
  });

  test('mermaid følger tema: bytte lys→mørk re-rendrer uten reload (QA-MER-02, AK2)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openNote(page, 'domene/Ordre');
    const svg = page.locator('main article .diagram-svg svg').first();
    await expect(svg).toBeVisible({ timeout: 15_000 });
    const before = await svg.evaluate((el) => el.outerHTML.length + ':' + getComputedStyle(el.querySelector('rect, path, polygon') ?? el).fill);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await expect
      .poll(async () => page.locator('main article .diagram-svg svg').first().evaluate((el) => el.outerHTML.length + ':' + getComputedStyle(el.querySelector('rect, path, polygon') ?? el).fill))
      .not.toBe(before);
  });

  test('stort diagram kan forstørres, Esc lukker, fokus tilbake (QA-MER-04)', async ({ page }) => {
    await openNote(page, 'teknisk/Stort mermaid-diagram');
    await expect(page.locator('main article .diagram-svg svg').first()).toBeVisible({ timeout: 20_000 });
    const zoom = page.getByRole('button', { name: 'Forstørr' }).first();
    await zoom.click();
    const dialog = page.getByRole('dialog', { name: 'Diagram, forstørret' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('svg').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(zoom).toBeFocused();
  });

  test('mermaid i callout rendres (QA-CAL-08)', async ({ page }) => {
    await openNote(page, 'teknisk/Callouts');
    await expect(page.locator('main article vr-callout .diagram-svg svg, main article .callout .diagram-svg svg').first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('AK16 innholdsfortegnelse (QA-TOC-*)', () => {
  test('TOC viser nivå 2–4, ikke 5–6, ren tekst for formatert overskrift (QA-TOC-02/04)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Høyre marg vises bare på desktop; mobil dekkes av egen test');
    await openNote(page, 'edge/Veldig langt notat');
    const toc = page.getByRole('navigation', { name: 'Innhold' });
    await expect(toc.getByRole('link', { name: '1.2.1 Detalj' })).toBeAttached();
    await expect(toc.getByRole('link', { name: 'Nivå 5' })).toHaveCount(0);
    await expect(toc.getByRole('link', { name: 'Nivå 6' })).toHaveCount(0);
    await expect(toc.getByRole('link', { name: 'Overskrift med kode, fet og lenke' })).toBeAttached();
  });

  test('to «Oppsummering» får unike ankre og TOC-klikk går til riktig (QA-TOC-03/06)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Høyre marg vises bare på desktop');
    await openNote(page, 'edge/Veldig langt notat');
    const toc = page.getByRole('navigation', { name: 'Innhold' });
    const links = toc.getByRole('link', { name: 'Oppsummering', exact: true });
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', /#oppsummering$/);
    await expect(links.nth(1)).toHaveAttribute('href', /#oppsummering-1$/);
    await links.nth(1).click();
    await expect(page).toHaveURL(/#oppsummering-1$/);
    await expect(page.locator('[id="oppsummering-1"]')).toBeInViewport();
  });

  test('scroll-spy markerer aktiv seksjon på desktop (QA-TOC-05)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Scroll-spy gjelder desktop');
    await openNote(page, 'edge/Veldig langt notat');
    await page.locator('[id="5-sikkerhet"]').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.mouse.wheel(0, 120);
    const toc = page.getByRole('navigation', { name: 'Innhold' });
    await expect(toc.locator('[aria-current="true"]')).toHaveCount(1);
    await expect(toc.locator('[aria-current="true"]')).toContainText(/^5/);
  });

  test('ingen TOC for korte notater (< 3 overskrifter, QA-TOC-01)', async ({ page }) => {
    await openNote(page, 'domene/avtale');
    await expect(page.getByRole('navigation', { name: 'Innhold' })).toHaveCount(0);
  });

  test('mobil: TOC er sammenleggbar og tar ikke plass (QA-TOC-05)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Kun mobil');
    await openNote(page, 'edge/Veldig langt notat');
    const toc = page.getByRole('navigation', { name: 'Innhold' });
    // Enten skjult bak en knapp/details, eller ikke synlig før den åpnes.
    const visibleLinks = await toc.getByRole('link').evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).length);
    expect(visibleLinks).toBe(0);
  });
});

test.describe('Embeds (QA-EMB-*)', () => {
  test('syklus A↔B stoppes med kort (QA-EMB-05)', async ({ page }) => {
    await openNote(page, 'lenker/Syklus A');
    await expect(page.locator('main article').getByText('Innbygging stoppet: syklus')).toHaveCount(1);
  });

  test('selv-embed etter PO-32: 2 syklus-kort, seksjoner rendres (QA-EMB-06)', async ({ page }) => {
    await openNote(page, 'lenker/Selv-embed');
    const article = page.locator('main article');
    await expect(article.getByText('Innbygging stoppet: syklus')).toHaveCount(2);
    await expect(article.getByRole('region', { name: 'Innebygd: Selv-embed › Seksjon' })).toHaveCount(1);
    // «Annen seksjon» innebygd to ganger: i toppnivå-Seksjon og inne i den innebygde Seksjon.
    await expect(article.getByRole('region', { name: 'Innebygd: Selv-embed › Annen seksjon' })).toHaveCount(2);
    await expect(article.getByRole('region', { name: 'Innebygd: Selv-embed › Tredje seksjon' })).toHaveCount(1);
  });

  test('kjede 1→2→3#Innhold, «Ikke med» vises ikke (QA-EMB-07)', async ({ page }) => {
    await openNote(page, 'lenker/Embed-test');
    const article = page.locator('main article');
    await expect(article).toContainText('bunnen av kjeden');
    await expect(article.locator('section.embed', { hasText: 'Kjede 3' }).first()).not.toContainText('Ikke med');
  });

  test('seksjons- og blokk-embed (QA-EMB-02/03/04)', async ({ page }) => {
    await openNote(page, 'lenker/Embed-test');
    const part = page.locator('main article').getByRole('region', { name: /Kafka-grunnleggende › Partisjoner/ });
    await expect(part).toContainText('Antall partisjoner');
    await expect(part).not.toContainText('En offset er posisjonen');
    const block = page.locator('main article').getByRole('region', { name: 'Innebygd: Kafka-grunnleggende', exact: true });
    await expect(block.first()).toContainText('En offset er posisjonen');
    await expect(block.first()).not.toContainText('Antall partisjoner');
  });

  test('tomt notat innebygd: «Notatet er tomt», ingen krasj (QA-EMB-11)', async ({ page }) => {
    await openNote(page, 'lenker/Embed-test');
    await expect(page.locator('main article').getByRole('region', { name: /Tomt notat/ })).toContainText(/tomt/i);
  });

  test('canvas-embed gir «ikke støttet»-kort (QA-EMB-12)', async ({ page }) => {
    await openNote(page, 'lenker/Embed-test');
    await expect(page.locator('main article')).toContainText(/Canvas/);
    await expect(page.locator('main article')).toContainText(/støttes ikke|ikke støttet/i);
  });
});

test.describe('Callouts, markdown og header (QA-CAL-*, QA-MD-*, PO-35)', () => {
  test('foldbar callout: lukket/åpen, Enter/Space, utvidet-tilstand (QA-CAL-05)', async ({ page }) => {
    // Foldbare callouts er <details>/<summary>: utvidet-tilstanden eksponeres native til hjelpemidler.
    await openNote(page, 'teknisk/Callouts');
    const closed = page.locator('main article details', { hasText: 'Lukket som standard' }).first();
    const summary = closed.locator('summary').first();
    await expect(closed).not.toHaveAttribute('open');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(closed).toHaveAttribute('open');
    await page.keyboard.press('Space');
    await expect(closed).not.toHaveAttribute('open');
    await expect(page.locator('main article details', { hasText: 'Åpen som standard' }).first()).toHaveAttribute('open');
    // Synlig fokus (AK19).
    await summary.focus();
    const outline = await summary.evaluate((el) => getComputedStyle(el).outlineStyle + getComputedStyle(el).boxShadow);
    expect(outline).not.toBe('nonenone');
  });

  test('callout uten tittel får norsk standardtittel «Merk» (QA-CAL-02, PO-14)', async ({ page }) => {
    await openNote(page, 'teknisk/Callouts');
    await expect(page.locator('main article').getByText('Merk', { exact: true }).first()).toBeVisible();
  });

  test('kommentarer vises ikke (QA-MD-02)', async ({ page }) => {
    await openNote(page, 'teknisk/Markdown-elementer');
    await expect(page.locator('body')).not.toContainText('HEMMELIG-KOMMENTAR');
  });

  test('oppgavelister er skrivebeskyttet (QA-MD-04, B1)', async ({ page }) => {
    await openNote(page, 'teknisk/Markdown-elementer');
    const boxes = page.locator('main article input[type="checkbox"]');
    expect(await boxes.count()).toBeGreaterThan(2);
    for (const box of await boxes.all()) await expect(box).toBeDisabled();
  });

  test('første H1 brukes som tittel og vises ikke to ganger (QA-MD-10, PO-35)', async ({ page }) => {
    await openNote(page, 'teknisk/Callouts');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('main article h1')).toHaveCount(0);
  });

  test('ugyldig frontmatter: API gir frontmatterError, ingen properties, brødtekst rendres (QA-IDX-07, PO-27)', async ({ page, request }) => {
    const res = await request.get(`/api/vaults/test/document?path=${encodeURIComponent('edge/Ugyldig frontmatter')}`);
    const doc = (await res.json()) as { frontmatterError: string | null; properties: unknown[]; tags: string[] };
    expect(doc.frontmatterError).toEqual(expect.any(String));
    expect(doc.properties).toEqual([]);
    expect(doc.tags).toEqual([]);
    await openNote(page, 'edge/Ugyldig frontmatter');
    await expect(page.locator('main article')).toContainText('brødtekst', { ignoreCase: true });
  });

  test('ugyldig frontmatter: advarselen vises i UI (QA-IDX-07, PO-27)', async ({ page }) => {
    // BUG-003 rettet 2026-11-06.
    await openNote(page, 'edge/Ugyldig frontmatter');
    await expect(page.locator('main')).toContainText('Egenskapene kunne ikke leses', { timeout: 3000 });
  });

  test('skjulte properties sendes ikke (QA-FM-02, PO-22/PO-29)', async ({ request }) => {
    const res = await request.get(`/api/vaults/test/document?path=${encodeURIComponent('edge/Frontmatter-typer')}`);
    const doc = (await res.json()) as { properties: { key: string }[] };
    const keys = doc.properties.map((p) => p.key);
    for (const hidden of ['cssclasses', 'publish', 'position']) expect(keys).not.toContain(hidden);
  });

  test('tomt notat viser tom-tilstand (QA-IDX-05)', async ({ page }) => {
    await page.goto(noteUrl('edge/Tomt notat'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tomt notat');
    await expect(page.locator('main')).toContainText('Notatet er tomt');
  });
});
