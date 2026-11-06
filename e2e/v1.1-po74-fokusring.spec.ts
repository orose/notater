// PO-74 (kundefunn i prototypen): etter frem- og tilbakebytte av lesebredde hang det igjen en loddrett strek på
// hver side av lesespalten. Årsak: `main.page` har tabindex=-1, et klikk i teksten gir den fokus, og neste
// tastetrykk gjør fokuset til :focus-visible, så den globale fokusringen tegnes rundt hele siden.
// Regel (designsystem §11.3): programmatiske fokusmål med tabindex=-1 har aldri fokusring. Skrevet av frontend (slice 1.1-b).
import type { Page } from '@playwright/test';
import { expect, openNote, test } from './support/guards';
import { artikkel, fasit, trykkSekvens } from './support/v11';

test.skip(({ isMobile }) => isMobile, 'Tastatur (Space w) testes på desktop');

/** Ingen synlige kantlinjer eller outlines på lesespalten og dens beholdere. */
function kanterRundtLesespalten(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const funn: string[] = [];
    const main = document.querySelector('main');
    for (const el of [main, main?.querySelector('.col'), main?.querySelector('article')]) {
      if (!el) continue;
      const s = getComputedStyle(el);
      if (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) funn.push(`${el.tagName}.${el.className}: outline ${s.outlineStyle}`);
      for (const side of ['left', 'right']) {
        if (parseFloat(s.getPropertyValue(`border-${side}-width`)) > 0 && s.getPropertyValue(`border-${side}-style`) !== 'none') {
          funn.push(`${el.tagName}.${el.className}: kant ${side}`);
        }
      }
    }
    return funn;
  });
}

for (const zen of [false, true]) {
  test(`PO-74 klikk i teksten, Space w to ganger${zen ? ' (i zen)' : ''}: ingen fokusring eller kantlinjer rundt lesespalten`, async ({ page }) => {
    await openNote(page, fasit.langBrodtekst.sti);
    if (zen) {
      await artikkel(page).locator('p').first().click();
      await trykkSekvens(page, ['Space', 'z']);
      await expect(page.locator('html')).toHaveAttribute('data-zen', 'on');
    }
    await artikkel(page).locator('p').nth(1).click();
    await trykkSekvens(page, ['Space', 'w']);
    await expect(page.locator('html')).toHaveAttribute('data-width', 'full');
    await trykkSekvens(page, ['Space', 'w']);
    await expect(page.locator('html')).not.toHaveAttribute('data-width', 'full');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.querySelector('main') as Element).outlineStyle)).toBe('none');
    expect(await kanterRundtLesespalten(page)).toEqual([]);
    // Også mens full bredde er på.
    await trykkSekvens(page, ['Space', 'w']);
    expect(await kanterRundtLesespalten(page)).toEqual([]);
  });
}

test('PO-74 rullbare områder med tabindex=0 beholder fokusringen', async ({ page }) => {
  await openNote(page, 'teknisk/Stor kodeblokk');
  const pre = page.locator('main [tabindex="0"]').first();
  test.skip((await pre.count()) === 0, 'Ingen rullbare områder i notatet');
  await page.keyboard.press('Tab');
  await pre.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect.poll(() => pre.evaluate((el) => (el === document.activeElement ? getComputedStyle(el).outlineStyle : 'ikke fokus'))).not.toBe('none');
});
