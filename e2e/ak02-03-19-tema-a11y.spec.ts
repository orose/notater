// AK2 tema følger OS, AK3 manuell overstyring huskes, AK19 WCAG AA (axe), fokus og reduced motion.
// Kjøres i prosjektene desktop (1440) og mobil (360) × lys/mørk. Mot den ekte serveren.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, noteUrl, openNote, test } from './support/guards';

const AXE_PAGES = [
  'Velkommen',
  'teknisk/Kafka/Kafka-grunnleggende',
  'teknisk/Callouts',
  'teknisk/Kodeblokker – alle språk',
  'teknisk/Mermaid-galleri',
  'lenker/Lenketest',
  'edge/Frontmatter-typer',
];

interface Violation {
  readonly id: string;
  readonly impact: string | null | undefined;
  readonly target: string;
  readonly html: string;
}

/** Kjente, uløste brudd med bug-ID (docs/test/bugs.md). Filtreres bort i hovedtestene og skal ha egne test.fail-tester. */
// BUG-004 og BUG-005 er rettet (2026-11-06); listen er tom, men beholdes for framtidige kjente brudd.
const KNOWN: readonly { bug: string; id: string; html?: RegExp; target?: RegExp }[] = [];

/** Regresjonssignaturer for rettede bugs. */
const REGRESSIONS: readonly { bug: string; id: string; html?: RegExp; target?: RegExp }[] = [
  { bug: 'BUG-004', id: 'color-contrast', html: /^<b>\d+<\/b>$/ },
  { bug: 'BUG-005', id: 'label', target: /task-list-item/ },
];
const regressionOf = (v: Violation) => REGRESSIONS.find((k) => k.id === v.id && (!k.html || k.html.test(v.html)) && (!k.target || k.target.test(v.target)))?.bug;

const knownBug = (v: Violation) => KNOWN.find((k) => k.id === v.id && (!k.html || k.html.test(v.html)) && (!k.target || k.target.test(v.target)))?.bug;

async function axe(page: Page): Promise<Violation[]> {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return result.violations.flatMap((v) => v.nodes.map((n) => ({ id: v.id, impact: v.impact, target: n.target.join(' '), html: n.html.slice(0, 160) })));
}

/** Ukjente brudd feiler testen; kjente legges ved som annotasjon. */
async function expectNoNewViolations(page: Page): Promise<void> {
  const all = await axe(page);
  for (const v of all.filter(knownBug)) test.info().annotations.push({ type: knownBug(v)!, description: `${v.id}: ${v.target}` });
  expect(all.filter((v) => !knownBug(v))).toEqual([]);
}

test.describe('AK19 axe-core (wcag2a/aa, wcag21a/aa) – 0 brudd', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const path of AXE_PAGES) {
      test(`${scheme}: ${path}`, async ({ page }) => {
        test.slow();
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await openNote(page, path);
        await expect(page.locator('html')).toHaveAttribute('data-mode', scheme);
        if (path.includes('Mermaid')) await expect(page.locator('main article .diagram-svg svg').first()).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(300);
        await expectNoNewViolations(page);
      });
    }

    test(`${scheme}: søkedialog åpen`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await openNote(page, 'Velkommen');
      await page.keyboard.press('ControlOrMeta+k');
      await page.getByRole('combobox').fill('kafka');
      await expect(page.getByRole('option').first()).toBeVisible();
      await expectNoNewViolations(page);
    });

    test(`${scheme}: «ikke skrevet ennå»-side`, async ({ page, guards }) => {
      guards.allowConsole.push(/status of 404/);
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto(noteUrl('finnes/ikke'));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoNewViolations(page);
    });
  }
});

test.describe('AK19 regresjon for rettede axe-bugs', () => {
  test('BUG-004: tallene i taggskyen har for lav kontrast i lyst tema', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Sidepanelet er skjult på mobil');
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await openNote(page, 'Velkommen');
    expect((await axe(page)).filter((v) => regressionOf(v) === 'BUG-004')).toEqual([]);
  });

  test('BUG-005: avkrysningsbokser i oppgavelister mangler tilgjengelig navn', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openNote(page, 'teknisk/Callouts');
    expect((await axe(page)).filter((v) => regressionOf(v) === 'BUG-005')).toEqual([]);
  });
});

test.describe('AK2/AK3 tema mot ekte server', () => {
  test('tema følger OS live, også etter navigasjon (AK2)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openNote(page, 'Velkommen');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    // Bakgrunnen kan ha en transition; vent til den er ferdig.
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(darkBg);
  });

  test('manuelt valg «Mørk» huskes over reload og overstyrer OS; «System» gjenoppretter (AK3)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openNote(page, 'Velkommen');
    const openPicker = async () => {
      const button = page.getByRole('button', { name: 'Utseende' });
      if (!(await button.isVisible())) await page.getByRole('button', { name: 'Åpne navigasjon' }).click();
      await page.getByRole('button', { name: 'Utseende' }).click();
    };
    await openPicker();
    await page.getByRole('radio', { name: 'Mørk' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await openPicker();
    await page.getByRole('radio', { name: 'System' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  });
});

test.describe('AK19 tastatur, fokus og reduced motion', () => {
  test('hopp-til-innhold og synlig fokus på første Tab', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Hopp til innhold' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });

  test('tastaturflyt: søk → notat → følg lenke, kun tastatur', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('Lenketest');
    await expect(page.getByRole('option').first()).toContainText('Lenketest');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lenketest');
    // Tab frem til «Ordre»-lenken i artikkelen og følg den med Enter.
    const target = page.locator('main article').getByRole('link', { name: 'Ordre', exact: true }).first();
    for (let i = 0; i < 80 && !(await target.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(target).toBeFocused();
    const ring = await target.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle}|${s.outlineWidth}|${s.boxShadow}`;
    });
    expect(ring, 'synlig fokusmarkering').not.toMatch(/^none\|.*\|none$/);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ordre');
  });

  test('prefers-reduced-motion: ingen transitions/animasjoner > 0 ms', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openNote(page, 'teknisk/Callouts');
    const animated = await page.evaluate(() => {
      const hits: string[] = [];
      for (const el of document.querySelectorAll('body *')) {
        const s = getComputedStyle(el);
        const t = s.transitionDuration.split(',').some((d) => parseFloat(d) > 0.01);
        const a = s.animationName !== 'none' && s.animationDuration.split(',').some((d) => parseFloat(d) > 0.01);
        if (t || a) hits.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
      }
      return [...new Set(hits)].slice(0, 15);
    });
    expect(animated).toEqual([]);
  });
});
