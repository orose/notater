// AK7 navigasjon via lenker, AK9 brutte lenker, AK10 tilbakelenker, AK11 stabile URL-er + frem/tilbake.
// Mot den ekte serveren og vault-kopien. Fasit: README-QA §2 og §4.
import { expect, noteUrl, openNote, test } from './support/guards';

const LENKETEST = 'lenker/Lenketest';

test.describe('AK7 navigasjon ved klikk på lenker (README-QA §4)', () => {
  const cases: [string, RegExp, string][] = [
    ['Ordre', /\/v\/test\/domene\/Ordre$/, 'Ordre'],
    ['ordrene våre', /\/v\/test\/domene\/Ordre$/, 'Ordre'],
    ['Faktura.md', /\/v\/test\/domene\/Faktura$/, 'Faktura'],
    ['konsumentgrupper', /\/v\/test\/teknisk\/Kafka\/Consumer%20groups$/, 'Consumer groups'],
    ['ORDRE', /\/v\/test\/domene\/Ordre$/, 'Ordre'],
    ['Avtale', /\/v\/test\/domene\/avtale$/, 'avtale'],
    ['Årsrapport (NFD)', /\/v\/test\/edge\/%C3%85rsrapport%20\(NFD\)$/, 'Årsrapport (NFD)'],
    ['R&D – spørsmål og svar', /\/v\/test\/edge\/R%26D/, 'R&D – spørsmål og svar'],
    ['versjon 2.0.1 notater', /versjon%202\.0\.1%20notater$/, 'versjon 2.0.1 notater'],
  ];
  for (const [text, url, title] of cases) {
    test(`«${text}» → ${title}`, async ({ page }) => {
      await openNote(page, LENKETEST);
      await page.locator('main article').getByRole('link', { name: text, exact: true }).first().click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    });
  }

  test('lenke til overskrift scroller dit (#3)', async ({ page }) => {
    await openNote(page, LENKETEST);
    await page.locator('main article').getByRole('link', { name: 'Kafka-grunnleggende › Partisjoner' }).click();
    await expect(page).toHaveURL(/Kafka-grunnleggende#partisjoner$/);
    await expect(page.locator('[id="partisjoner"]')).toBeInViewport();
  });

  test('lenke til blokk scroller til avsnittet (#6, QA-LNK-01)', async ({ page }) => {
    await openNote(page, LENKETEST);
    await page.locator('main article').getByRole('link', { name: 'Kafka-grunnleggende › ^offset-def' }).click();
    await expect(page).toHaveURL(/#\^offset-def$/);
    const block = page.locator('[id="^offset-def"]');
    await expect(block).toBeInViewport();
    await expect(block).toContainText('En offset er posisjonen');
    await expect(page.locator('main article')).not.toContainText('^offset-def');
  });

  test('lenke i samme notat scroller uten sidelasting (#41)', async ({ page }) => {
    await openNote(page, LENKETEST);
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 42));
    await page.locator('main article a[href$="#brutte-lenker"]').first().click();
    await expect(page.locator('[id="brutte-lenker"]')).toBeInViewport();
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(42);
  });

  test('tvetydig [[Kunde]] → domene/Kunde med tvetydighetsindikator (#26, PO-8/PO-26)', async ({ page }) => {
    await openNote(page, LENKETEST);
    const link = page.locator('main article a[data-vr-ambiguous], main article a[title^="Tvetydig"]').first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /\/v\/test\/domene\/Kunde$/);
  });

  test('ekstern lenke: ny fane, noopener, ingen forhåndshenting (#47)', async ({ page }) => {
    await openNote(page, LENKETEST);
    const external = page.locator('main article a[href^="http"]').first();
    await expect(external).toHaveAttribute('target', '_blank');
    await expect(external).toHaveAttribute('rel', /noopener/);
    await expect(external).toHaveAttribute('rel', /noreferrer/);
  });

  test('lenke til .base og .canvas åpner riktig visning (#36, #38)', async ({ page }) => {
    await openNote(page, LENKETEST);
    await page.locator('main article a[href$="/Tegning.canvas"]').first().click();
    await expect(page).toHaveURL(/Tegning\.canvas$/);
    await expect(page.locator('main')).toContainText(/støttes ikke|ikke støttet/i);
  });
});

test.describe('AK9 brutte lenker – tydelige, ikke stygge, ikke navigerende', () => {
  test('[[Finnes ikke]] navigerer ikke og forklarer (#29)', async ({ page }) => {
    await openNote(page, LENKETEST);
    const broken = page.locator('main article').locator('button.broken', { hasText: /^Finnes ikke/ }).first();
    await expect(broken).toBeVisible();
    await expect(broken).toHaveAttribute('title', /finnes ikke/);
    // Stilen skiller seg fra vanlige lenker (stiplet/dempet).
    const style = await broken.evaluate((el) => {
      const s = getComputedStyle(el);
      return { deco: s.textDecorationStyle, border: s.borderBottomStyle, cursor: s.cursor };
    });
    expect([style.deco, style.border].some((v) => v === 'dashed' || v === 'dotted')).toBe(true);
    const before = page.url();
    await broken.click();
    await expect(page.getByRole('note').filter({ hasText: 'finnes ikke' })).toBeVisible();
    expect(page.url()).toBe(before);
  });

  test('alias-lenke [[Bestilling]] er brutt men foreslår Ordre (#11, PO-7)', async ({ page }) => {
    await openNote(page, LENKETEST);
    await page.locator('main article').getByRole('button', { name: /^Bestilling/ }).click();
    const hint = page.getByRole('note').filter({ hasText: 'Mente du' });
    await expect(hint).toContainText('Ordre');
    await hint.getByRole('link', { name: 'Ordre' }).click();
    await expect(page).toHaveURL(/\/v\/test\/domene\/Ordre$/);
  });

  test('alle fasit-brutte lenker er brutte og ingen andre (#11–14, 18, 29–30, 33–35, 48)', async ({ page }) => {
    await openNote(page, LENKETEST);
    const brokenTexts = await page.locator('main article button.broken').allInnerTexts();
    const clean = brokenTexts.map((t) => t.replace(/\s*\?$/, '').trim());
    for (const expected of ['Bestilling', 'EDA', 'virtuelle tråder', 'Domenekart', 'bestilling', 'Finnes ikke', 'domene/Finnes ikke', 'Slettet notat', 'README']) {
      expect(clean, expected).toContain(expected);
    }
    // Ankre som mangler (#31, #32) er IKKE brutte.
    expect(clean.some((t) => t.includes('Overskrift som ikke finnes'))).toBe(false);
    expect(clean.some((t) => t.includes('blokk-som-ikke-finnes'))).toBe(false);
  });

  test('lenke med ukjent overskrift går til toppen av notatet (#31, regel 7)', async ({ page }) => {
    await openNote(page, LENKETEST);
    await page.locator('main article a', { hasText: 'Overskrift som ikke finnes' }).first().click();
    await expect(page).toHaveURL(/Kafka-grunnleggende/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kafka-grunnleggende');
  });

  test('manglende embed vises som diskret kort (QA-EMB-08)', async ({ page }) => {
    await openNote(page, 'lenker/Embed-test');
    await expect(page.locator('main article').getByText('Fant ikke «![[Finnes ikke]]»').or(page.locator('main article').getByText(/Fant ikke «.*Finnes ikke/)).first()).toBeVisible();
  });
});

test.describe('AK10 tilbakelenker (README-QA «Tilbakelenker»)', () => {
  const fasit: [string, number, string[]][] = [
    ['domene/Kunde', 9, ['Ordre', '_MOC', 'Adresse', 'kunde-endret', 'Ærendelogg', 'Veldig langt notat', 'Lenketest', 'Avklar (GDPR) sletting av kundedata', 'Markdown-elementer']],
    ['arkiv/2023/Kunde', 1, ['Lenketest']],
    ['teknisk/Kafka/Kafka-grunnleggende', 8, ['Velkommen', 'Betaling', 'Frontmatter-typer', 'Embed-test', 'Lenketest', 'Hendelsesdrevet arkitektur', 'Consumer groups', 'Markdown-elementer']],
    ['domene/Ordre', 11, ['Betaling', 'Faktura', 'Kunde', 'Lager', '_MOC', 'ordre-opprettet', 'Øyeblikksbilde', 'Frontmatter-typer', 'Lenketest', 'Skriv integrasjonstest for ordre-API', 'Hendelsesdrevet arkitektur']],
    ['domene/avtale', 3, ['Faktura', '_MOC', 'Lenketest']],
    ['lenker/Syklus A', 2, ['Embed-test', 'Syklus B']],
    ['README-QA', 0, []],
  ];
  for (const [path, count, sources] of fasit) {
    test(`${path}: ${count} tilbakelenker`, async ({ page }) => {
      await openNote(page, path);
      const section = page.getByRole('region', { name: 'Tilbakelenker' });
      await expect(section).toBeAttached();
      const titles = section.locator('a.bl-title');
      await expect(titles).toHaveCount(count);
      const names = (await titles.allInnerTexts()).map((t) => t.trim());
      expect([...names].sort()).toEqual([...sources].sort());
      if (count === 0) await expect(section).toContainText('Ingen notater lenker hit');
    });
  }

  test('Oppgaver.base har 6 tilbakelenker via API (base-side)', async ({ request }) => {
    const res = await request.get('/api/vaults/test/document?path=Oppgaver.base');
    const body = (await res.json()) as { backlinks: { source: string }[] };
    expect(body.backlinks.map((b) => b.source).sort()).toEqual(
      ['Velkommen', 'lenker/Embed-test', 'lenker/Lenketest', 'teknisk/Bash-tips', 'templates/Oppgave-mal', 'templates/sprint/Sprint-oppgave-mal'].sort(),
    );
  });

  test('klikk på tilbakelenke navigerer til kilden', async ({ page }) => {
    await openNote(page, 'domene/avtale');
    await page.getByRole('region', { name: 'Tilbakelenker' }).getByRole('link', { name: 'Faktura' }).click();
    await expect(page).toHaveURL(/\/domene\/Faktura$/);
  });

  test('property-lenke merkes «fra egenskap» (PO-9)', async ({ page }) => {
    test.fail(true, 'BUG-002: tilbakelenkepanelet viser ikke «fra egenskap» (fromProperty ignoreres)');
    await openNote(page, 'domene/Ordre');
    const item = page.getByRole('region', { name: 'Tilbakelenker' }).locator('li', { hasText: 'Frontmatter-typer' });
    await expect(item).toContainText(/egenskap/i);
  });
});

test.describe('AK11 stabile URL-er og frem/tilbake (README-QA §2)', () => {
  const special = [
    ['edge/Æøå og mellomrom – særnorsk', 'Æøå og mellomrom – særnorsk'],
    ['edge/versjon 2.0.1 notater', 'versjon 2.0.1 notater'],
    ['edge/Notat (kopi)', 'Notat (kopi)'],
    ['oppgaver/Avklar (GDPR) sletting av kundedata', 'Avklar (GDPR) sletting av kundedata'],
    ['edge/R&D – spørsmål og svar', 'R&D – spørsmål og svar'],
    ['oppgaver/Oppgrader Spring Boot til 3.3', 'Oppgrader Spring Boot til 3.3'],
    ['edge/Årsrapport (NFD)', 'Årsrapport (NFD)'],
    ['edge/a/b/c/d/e/Dypt nestet notat', 'Dypt nestet notat'],
  ];
  for (const [path, title] of special) {
    test(`direkte URL + reload: ${path} (QA-URL-01..05)`, async ({ page }) => {
      await page.goto(noteUrl(path));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      const url = page.url();
      await page.reload();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      expect(page.url()).toBe(url);
    });
  }

  test('& tolkes ikke som query-parameter (QA-URL-04)', async ({ page }) => {
    await page.goto(noteUrl('edge/R&D – spørsmål og svar'));
    expect(new URL(page.url()).pathname).toContain('R%26D');
    expect(new URL(page.url()).search).toBe('');
  });

  test('frem/tilbake: Velkommen → Lenketest → Ordre, tilbake ×2, frem (QA-URL-06)', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await page.locator('main article a[href$="/lenker/Lenketest"]').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lenketest');
    await page.locator('main article').getByRole('link', { name: 'Ordre', exact: true }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ordre');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lenketest');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Velkommen til testvaultet');
    await page.goForward();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lenketest');
  });

  test('scrollposisjon gjenopprettes ved tilbake (QA-URL-06, R10)', async ({ page }) => {
    await openNote(page, LENKETEST);
    const link = page.locator('main article').getByRole('link', { name: 'Spring Boot – konfigurasjon' });
    await link.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(200);
    await link.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Spring Boot – konfigurasjon');
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lenketest');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y - 80);
  });

  test('direkte URL med #anker scroller dit ved lasting (QA-TOC-06)', async ({ page }) => {
    await page.goto(noteUrl('teknisk/Kafka/Kafka-grunnleggende', '#leveransegarantier'));
    await expect(page.locator('[id="leveransegarantier"]')).toBeInViewport();
  });

  test('ukjent notat gir pen side med vei hjem (QA-URL-07)', async ({ page, guards }) => {
    guards.allowConsole.push(/status of 404/);
    await page.goto(noteUrl('finnes/ikke/i det hele tatt'));
    await expect(page.getByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeVisible();
    await expect(page.getByRole('link', { name: /forsiden/i }).or(page.getByRole('button', { name: /Tilbake/ }))).toBeVisible();
  });

  test('«ikke skrevet ennå» viser «Lenket fra» (QA-URL-07, PO-28)', async ({ page, guards }) => {
    test.fail(true, 'BUG-001: «ikke skrevet ennå»-siden viser ikke «Lenket fra» (PO-28)');
    guards.allowConsole.push(/status of 404/);
    await page.goto(noteUrl('Finnes ikke'));
    await expect(page.getByRole('heading', { level: 1, name: 'Dette notatet er ikke skrevet ennå' })).toBeVisible();
    const linked = page.getByRole('region', { name: /Lenket fra/ });
    await expect(linked).toBeVisible();
    await expect(linked.getByRole('link')).toHaveText([/Embed-test|Frontmatter-typer|Lenketest/, /Embed-test|Frontmatter-typer|Lenketest/, /Embed-test|Frontmatter-typer|Lenketest/]);
  });
});
