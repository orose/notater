// AK13 ⌘K-søk (tittel, alias, innhold) + full tastaturflyt. Mot den ekte serveren. Fasit: README-QA §15.
import type { SearchResponse } from '../src/shared/api-types';
import { expect, openNote, test } from './support/guards';

const search = async (request: import('@playwright/test').APIRequestContext, q: string) =>
  ((await (await request.get(`/api/vaults/test/search?q=${encodeURIComponent(q)}`)).json()) as SearchResponse).hits;

test.describe('AK13 søke-API mot fasit (QA-SOK-01..08)', () => {
  const top: [string, string, string, string][] = [
    ['QA-SOK-01', 'kafka grunn', 'teknisk/Kafka/Kafka-grunnleggende', 'title'],
    ['QA-SOK-02', 'Bestilling', 'domene/Ordre', 'alias'],
    ['QA-SOK-03', 'særnorsk', 'edge/Æøå og mellomrom – særnorsk', 'title'],
    ['QA-SOK-03', 'Særnorsk', 'edge/Æøå og mellomrom – særnorsk', 'title'],
    ['QA-SOK-04', 'aerendelogg', 'domene/Ærendelogg', 'title'],
    ['QA-SOK-05', 'idempotensnøkler', 'domene/Betaling', 'content'],
  ];
  for (const [id, q, path, field] of top) {
    test(`${id}: «${q}» → ${path} øverst`, async ({ request }) => {
      const hits = await search(request, q);
      expect(hits[0]).toMatchObject({ path: path.normalize('NFC'), matchedField: field });
    });
  }

  test('QA-SOK-06: HEMMELIG-KOMMENTAR – ingen treff utenom README-QA (PO-33)', async ({ request }) => {
    const hits = await search(request, 'HEMMELIG-KOMMENTAR');
    expect(hits.map((h) => h.path).filter((p) => p !== 'README-QA')).toEqual([]);
  });

  test('QA-SOK-07: Slettet notat – ingen treff i .trash', async ({ request }) => {
    const hits = await search(request, 'Slettet notat');
    expect(hits.filter((h) => h.path.startsWith('.'))).toEqual([]);
  });

  test('QA-SOK-08: <script> gir treff i sikkerhetsnotatet', async ({ request }) => {
    const hits = await search(request, '<script>');
    expect(hits.map((h) => h.path)).toContain('edge/Sikkerhet – ondsinnet HTML');
  });

  test('taggsøk #task inkluderer nestede (QA-TAG-14, T2) og ikke taskforce', async ({ request }) => {
    const hits = await search(request, '#task');
    const paths = hits.map((h) => h.path);
    expect(paths).toContain('oppgaver/Migrer til Java 21');
    expect(paths).toContain('oppgaver/Bytt til records i DTO-er');
    expect(paths).not.toContain('teknisk/Bash-tips');
  });

  test('excalidraw er ikke med i søk (QA-IDX-11, BE15)', async ({ request }) => {
    const hits = await search(request, 'Skisse');
    expect(hits.map((h) => h.path)).not.toContain('edge/Skisse.excalidraw');
  });
});

test.describe('AK13 søk i UI (QA-SOK-08/09)', () => {
  test('Ctrl/⌘K åpner, piltaster flytter, Enter åpner, Esc lukker og returnerer fokus', async ({ page }) => {
    await openNote(page, 'Velkommen');
    const trigger = page.getByRole('button', { name: 'Søk i notater' });
    if (await trigger.isVisible()) await trigger.focus();
    await page.keyboard.press('ControlOrMeta+k');
    const input = page.getByRole('combobox');
    await expect(input).toBeFocused();
    await input.fill('kafka grunn');
    await expect(page.getByRole('option').first()).toContainText('Kafka-grunnleggende');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('option').nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kafka-grunnleggende');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Esc returnerer fokus til søkeknappen (QA-SOK-09)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Søkeknappen ligger i skuffen på mobil');
    await openNote(page, 'Velkommen');
    const trigger = page.getByRole('button', { name: 'Søk i notater' });
    await trigger.click();
    await expect(page.getByRole('combobox')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  });

  test('alias-treff vises med aliaset (QA-SOK-02)', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox').fill('Bestilling');
    await expect(page.getByRole('option').first()).toContainText('Ordre');
    await expect(page.getByRole('option').first()).toContainText('Bestilling');
  });

  test('<script> i treff vises escapet, ingen kjøring (QA-SOK-08)', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByRole('combobox').fill('<script>');
    await expect(page.getByRole('option').first()).toBeVisible();
    await expect(page.getByRole('listbox').locator('script')).toHaveCount(0);
  });

  test('snarvei vises som Ctrl K på ikke-Mac (PO-36)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Snarveien vises ikke på touch');
    await openNote(page, 'Velkommen');
    const trigger = page.getByRole('button', { name: 'Søk i notater' });
    await expect(trigger.locator('..')).toContainText(/Ctrl\s*K/);
    await expect(trigger.locator('..')).not.toContainText('⌘');
  });

  test('tagg-chip åpner søk på taggen (QA-TAG-14)', async ({ page }) => {
    await openNote(page, 'oppgaver/Rydd Kafka-konsumentgrupper');
    await page.locator('main').getByRole('button', { name: '#team' }).first().click();
    await expect(page.getByRole('combobox')).toHaveValue('#team');
    await expect(page.getByRole('option').first()).toBeVisible();
  });
});
