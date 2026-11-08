// Bases (slice 3–4): akseptansetester mot docs/test/bases-fasit.json, gjennom UI-et og API-et på den ekte
// serveren. Arkiv-viewet avhenger av fixture-mtimes (globalSetup) og tidssone Europe/Oslo (B10).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import type { BaseDocument, BaseView, NoteDocument } from '../src/shared/api-types';
import { REPO } from './support/real-server';
import { expect, noteUrl, openNote, test } from './support/guards';

test.use({ timezoneId: 'Europe/Oslo' });

interface FasitTable { name: string; type: 'table'; kolonner: string[]; rader?: string[]; grupper?: { verdi: string; rader: string[] }[]; antallRader?: number }
interface FasitKanban { name: string; type: 'kanban'; kortfelter: string[]; kolonner: { verdi: string | null; kort: string[] }[] }
interface FasitUnsupported { name: string; type: string; stottet: false }
type FasitView = FasitTable | FasitKanban | FasitUnsupported;

const fasit = JSON.parse(readFileSync(join(REPO, 'docs/test/bases-fasit.json'), 'utf8')) as {
  'Domene.base': { views: FasitView[]; skalIkkeVises: string[] };
  'Oppgaver.base': { views: FasitView[]; skalIkkeVises: string[] };
  'Sprintoversikt.md': { blokker: ({ views: FasitView[]; advarsler?: string[] } | { feil: string })[] };
};

const docPath = (filePath: string) => filePath.replace(/\.md$/, '');
const fileName = (filePath: string) => docPath(filePath).split('/').pop()!.normalize('NFC');

/** Radene i en tabell-region (første celle = file.name). Gruppe-rader (th[colspan]) gir «# label». */
async function tableRows(region: Locator): Promise<string[]> {
  return region.locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => (tr.classList.contains('group-row') ? `# ${(tr.querySelector('th')?.childNodes[0]?.textContent ?? '').trim()}` : (tr.querySelector('td')?.textContent ?? '').trim().normalize('NFC'))),
  );
}

function expectedTableRows(view: FasitTable): string[] {
  if (view.grupper) return view.grupper.flatMap((g) => [`# ${g.verdi}`, ...g.rader.map(fileName)]);
  return (view.rader ?? []).map(fileName);
}

async function kanbanLanes(region: Locator): Promise<{ label: string; cards: string[] }[]> {
  return region.locator('section.lane').evaluateAll((lanes) =>
    lanes.map((lane) => ({
      label: (lane.querySelector('.lane-head .label')?.textContent ?? '').trim(),
      cards: [...lane.querySelectorAll('a.card .t')].map((c) => (c.textContent ?? '').trim().normalize('NFC')),
    })),
  );
}

const laneLabel = (verdi: string | null) => verdi ?? '(ingen)';

async function selectTab(base: Locator, name: string): Promise<void> {
  const tab = base.getByRole('tab', { name: new RegExp(`^${name}`) });
  if ((await tab.count()) > 0) {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
}

async function expectView(page: Page, base: Locator, view: FasitView): Promise<void> {
  await selectTab(base, view.name);
  if (view.type === 'table') {
    const region = base.getByRole('region', { name: `Tabell: ${view.name}` });
    await expect(region).toBeVisible();
    if ((view as FasitTable).antallRader !== undefined) {
      await expect(region.locator('tbody tr:not(.group-row)')).toHaveCount((view as FasitTable).antallRader!);
    } else {
      expect(await tableRows(region), view.name).toEqual(expectedTableRows(view as FasitTable));
    }
  } else if (view.type === 'kanban') {
    const region = base.getByRole('region', { name: `Kanban: ${view.name}` });
    await expect(region).toBeVisible();
    const expected = (view as FasitKanban).kolonner.map((k) => ({ label: laneLabel(k.verdi), cards: k.kort.map(fileName) }));
    expect(await kanbanLanes(region), view.name).toEqual(expected);
    // Skrivebeskyttet (B1): ingen dra-og-slipp.
    await expect(region.locator('[draggable="true"]')).toHaveCount(0);
  } else {
    await expect(base).toContainText(/støttes ikke/);
  }
  void page;
}

test.describe('Bases – .base-filer mot fasit (bases-fasit §1–2)', () => {
  test('Domene.base: 12 rader i fasit-rekkefølge, ekskluderte vises ikke', async ({ page }) => {
    await openNote(page, 'Domene.base');
    const base = page.locator('main section.base').first();
    await expectView(page, base, fasit['Domene.base'].views[0]!);
    for (const excluded of fasit['Domene.base'].skalIkkeVises) await expect(base.locator('tbody')).not.toContainText(new RegExp(`^${fileName(excluded)}$`));
  });

  for (const view of fasit['Oppgaver.base'].views) {
    test(`Oppgaver.base – ${view.name} (${view.type})`, async ({ page }) => {
      await openNote(page, 'Oppgaver.base');
      const base = page.locator('main section.base').first();
      await expect(base.getByRole('tablist', { name: 'Visninger' }).getByRole('tab')).toHaveCount(3);
      await expectView(page, base, view);
    });
  }

  test('Huskeliste: columnSize brukes på desktop (file.name 553 px, status 101 px)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'columnSize gjelder desktop; mobil scroller internt');
    await openNote(page, 'Oppgaver.base');
    const headers = page.locator('main section.base').first().getByRole('region', { name: 'Tabell: Huskeliste' }).locator('thead th');
    expect(await headers.nth(0).getAttribute('style')).toContain('553px');
    expect(await headers.nth(1).getAttribute('style')).toContain('101px');
  });

  test('Arkiv: file.mtime vises dd.MM.yyyy HH:mm i Europe/Oslo (B10, fixture-mtimes)', async ({ page }) => {
    await openNote(page, 'Oppgaver.base');
    const base = page.locator('main section.base').first();
    await selectTab(base, 'Arkiv');
    const first = base.getByRole('region', { name: 'Tabell: Arkiv' }).locator('tbody tr').first();
    // oppgaver/Oppdater README.md: 2026-09-15T08:00:00Z = 15.09.2026 10:00 (CEST).
    await expect(first).toContainText('Oppdater README');
    await expect(first).toContainText('15.09.2026 10:00');
  });

  test('faner er tastaturnavigerbare (piltaster, role=tablist)', async ({ page }) => {
    await openNote(page, 'Oppgaver.base');
    const tabs = page.locator('main section.base').first().getByRole('tab');
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tabs.nth(2)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tabs.nth(0)).toBeFocused();
  });

  test('kort og rader lenker til notatet', async ({ page }) => {
    await openNote(page, 'Oppgaver.base');
    const base = page.locator('main section.base').first();
    await selectTab(base, 'Kanban');
    await base.locator('a.card', { hasText: 'Evaluer Testcontainers' }).click();
    await expect(page).toHaveURL(/oppgaver\/Evaluer%20Testcontainers$/);
  });

  test('API: Oppgaver.base-dokumentet har views i fasit-rekkefølge', async ({ request }) => {
    const doc = (await (await request.get('/api/vaults/test/document?path=Oppgaver.base')).json()) as BaseDocument;
    expect(doc.kind).toBe('base');
    expect(doc.result.views.map((v: BaseView) => `${v.name}:${v.type}`)).toEqual(fasit['Oppgaver.base'].views.map((v) => `${v.name}:${v.type}`));
  });
});

test.describe('Bases – inline-blokker i Sprintoversikt.md (bases-fasit §3)', () => {
  test('blokk 1 Kritisk (4), blokk 2 Team-kanban (5 kort / 3 kolonner)', async ({ page }) => {
    await openNote(page, 'Sprintoversikt');
    const bases = page.locator('main article section.base');
    await expect(bases).toHaveCount(4);
    const [b1, b2] = fasit['Sprintoversikt.md'].blokker as { views: FasitView[] }[];
    await expectView(page, bases.nth(0), b1!.views[0]!);
    await expectView(page, bases.nth(1), b2!.views[0]!);
  });

  test('blokk 3: ukjent funksjon/nøkkel gir advarsel, 18 rader; gallery «støttes ikke»', async ({ page }) => {
    await openNote(page, 'Sprintoversikt');
    const block = page.locator('main article section.base').nth(2);
    const b3 = fasit['Sprintoversikt.md'].blokker[2] as { views: FasitView[] };
    await expectView(page, block, b3.views[0]!);
    await expect(block.locator('.base-warn')).toContainText([/finnesIkke/]);
    await expect(block).toContainText(/ukjentNøkkel/);
    await expectView(page, block, b3.views[1]!);
  });

  test('blokk 4: ugyldig YAML gir feilkort, resten av notatet rendres', async ({ page }) => {
    await openNote(page, 'Sprintoversikt');
    const block = page.locator('main article section.base').nth(3);
    await expect(block).toContainText(/Kunne ikke lese base-definisjonen \(linje \d+\)/);
    await expect(block).toContainText(/ugyldig YAML/);
    await expect(page.locator('main article')).toContainText(/Oppgrader Spring Boot/);
    const doc = (await (await page.request.get('/api/vaults/test/document?path=Sprintoversikt')).json()) as NoteDocument;
    const warnings = Object.values(doc.bases).flatMap((b) => b.warnings.map((w) => w.code));
    expect(warnings.some((c) => /parse|yaml/i.test(c))).toBe(true);
  });
});

test.describe('Bases – embeds (QA-EMB-09/10/13, PO-12, PO-34)', () => {
  test('![[Domene.base]] i _MOC og Velkommen gir samme 12 rader (QA-EMB-13)', async ({ page }) => {
    for (const note of ['domene/_MOC', 'Velkommen']) {
      await openNote(page, note);
      const base = page.locator('main article section.base', { has: page.locator('a.src[href$="/Domene.base"]') }).first();
      await expectView(page, base, fasit['Domene.base'].views[0]!);
    }
  });

  test('Embed-test: ![[Oppgaver.base]] med 3 faner, #Kanban bare Kanban, #Ukjent advarsel med views', async ({ page }) => {
    await openNote(page, 'lenker/Embed-test');
    const bases = page.locator('main article section.base');
    await expect(bases).toHaveCount(3);
    await expect(bases.nth(0).getByRole('tab')).toHaveCount(3);
    await expect(bases.nth(0).getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');
    await expect(bases.nth(1).getByRole('tab')).toHaveCount(0);
    await expectView(page, bases.nth(1), fasit['Oppgaver.base'].views[1]!);
    // PO-34: «Viewet «Ukjent» finnes ikke» + liste, ingen fallback til første view.
    await expect(bases.nth(2)).toContainText('Viewet «Ukjent» finnes ikke');
    await expect(bases.nth(2)).toContainText(/Huskeliste.*Kanban.*Arkiv/);
    await expect(bases.nth(2).getByRole('region', { name: /Tabell: Huskeliste/ })).toHaveCount(0);
  });
});

test.describe('Bases – mobil og tilgjengelighet', () => {
  test('tabell og kanban scroller internt, ikke siden (AK5)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Kun mobil');
    await openNote(page, 'Oppgaver.base');
    const base = page.locator('main section.base').first();
    for (const tab of ['Huskeliste', 'Kanban', 'Arkiv']) {
      await selectTab(base, tab);
      expect(await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth), tab).toBeLessThanOrEqual(0);
    }
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`axe: Oppgaver.base, alle tre faner (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto(noteUrl('Oppgaver.base'));
      const base = page.locator('main section.base').first();
      await expect(base).toBeVisible();
      for (const tab of ['Huskeliste', 'Kanban', 'Arkiv']) {
        await selectTab(base, tab);
        const result = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(result.violations.flatMap((v) => v.nodes.map((n) => `${tab}: ${v.id} ${n.target.join(' ')}`))).toEqual([]);
      }
    });
  }
});
