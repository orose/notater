// AK-2-10 Alle taster i tabellen virker; `?` viser present-modusens taster; reserverte/⌥-taster er ikke bundet
//         (test mot registeret).
// AK-2-11 Fullskjerm startes/avsluttes; reload beholder lysbildet via URL.
// Også: klikker-taster, Space i present-modus mot leader, svart skjerm, oversikt, fremdrift (A5), touch,
// temabytte og avvist fullskjerm. Testplan: TC-2-10-*, TC-2-11-*. TDD: `test.fixme` til levert.
import { expect, openNote, test } from './support/guards';
import { brytNorskTastatur, brytReservert, konflikter, lastRegister, parseBinding, visTrinn } from './support/keymap-rules';
import {
  avsluttPresentasjon,
  fasit2,
  forventLerret169,
  fremdrift,
  gåTilLysbilde,
  lesLysbilde,
  lysbildeOverskrift,
  lysbildenummer,
  nummer,
  oversikt,
  oversiktLysbilder,
  presentasjon,
  presenter,
  startPresentasjon,
  svartSkjerm,
  ventPåLysbilde,
  ventPåPresentasjon,
} from './support/v2';
import { hurtigtastoversikt, kjørKommando, leaderHint, trykkNorsk } from './support/v11';

const s = fasit2.statusmote;
const t = fasit2.taster;
const ANTALL = s.lysbilder.length;

/** Playwright-navn for en tast i fasiten. */
const pw = (tast: string): string => (tast === 'Space' ? ' ' : tast === 'G' ? 'Shift+G' : tast);

test.describe('AK-2-10 navigasjonstaster', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');

  for (const tast of t.neste) {
    test.fixme(`TC-2-10-01 «${tast}» gir neste lysbilde, og stopper på siste`, async ({ page }) => {
      await presenter(page, s.sti);
      await page.keyboard.press(pw(tast));
      await ventPåLysbilde(page, 2);
      await page.keyboard.press('Shift+G');
      await ventPåLysbilde(page, ANTALL);
      await page.keyboard.press(pw(tast));
      await page.waitForTimeout(150);
      await ventPåLysbilde(page, ANTALL);
    });
  }

  for (const tast of t.forrige) {
    test.fixme(`TC-2-10-02 «${tast}» gir forrige lysbilde, og stopper på første`, async ({ page }) => {
      await presenter(page, s.sti);
      await gåTilLysbilde(page, 3);
      await page.keyboard.press(pw(tast));
      await ventPåLysbilde(page, 2);
      await page.keyboard.press(pw(tast));
      await page.keyboard.press(pw(tast));
      await page.waitForTimeout(150);
      await ventPåLysbilde(page, 1);
    });
  }

  test.fixme('TC-2-10-03 `gg` og `G` går til første og siste lysbilde', async ({ page }) => {
    await presenter(page, s.sti);
    await page.keyboard.press('Shift+G');
    await ventPåLysbilde(page, ANTALL);
    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await ventPåLysbilde(page, 1);
  });

  test.fixme('TC-2-10-04 klikker-taster (PageDown/PageUp, `.`, `b`) uten fokus på noe spesielt', async ({ page }) => {
    await presenter(page, s.sti);
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await ventPåLysbilde(page, 3);
    await page.keyboard.press('PageUp');
    await ventPåLysbilde(page, 2);
    await page.keyboard.press('Period');
    await expect(svartSkjerm(page)).toBeVisible();
    await page.keyboard.press('Period');
    await expect(svartSkjerm(page)).toBeHidden();
    await ventPåLysbilde(page, 2);
  });

  test.fixme('TC-2-10-05 Space i present-modus er «neste», ikke leader: ingen which-key, ingen forsinkelse', async ({ page }) => {
    await presenter(page, s.sti);
    const t0 = Date.now();
    await page.keyboard.press(' ');
    await ventPåLysbilde(page, 2);
    expect(Date.now() - t0, 'Space venter ikke på en leader-sekvens').toBeLessThan(350);
    await page.waitForTimeout(500);
    await expect(leaderHint(page)).toBeHidden();
    // `Space p` i present-modus = neste + forrige (ikke «start presentasjon» på nytt).
    await page.keyboard.press(' ');
    await page.keyboard.press('p');
    await ventPåLysbilde(page, 2);
    await expect(leaderHint(page)).toBeHidden();
    // Tastene til normal-modus virker ikke i present-modus.
    await page.keyboard.press('z');
    await page.keyboard.press('Shift+M');
    await page.keyboard.press(' ');
    await page.keyboard.press('w');
    await expect(page.locator('html')).not.toHaveAttribute('data-width', 'full');
  });

  test.fixme('TC-2-10-06 `b` og `.` gir svart skjerm av/på; annen tast enn b/./Esc endrer ikke lysbildet mens den er svart', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 4);
    for (const tast of t.svart) {
      await page.keyboard.press(pw(tast));
      await expect(svartSkjerm(page)).toBeVisible();
      const farge = await svartSkjerm(page).evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(farge).toBe('rgb(0, 0, 0)');
      await expect(presentasjon(page).getByText('STATUS-A')).toBeHidden();
      await page.keyboard.press(pw(tast));
      await expect(svartSkjerm(page)).toBeHidden();
    }
    await ventPåLysbilde(page, 4);
  });

  test.fixme('TC-2-10-07 `o` åpner oversikten med gjeldende uthevet; piltaster/hjkl + Enter hopper; Esc lukker', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 4);
    await page.keyboard.press('o');
    await expect(oversikt(page)).toBeVisible();
    await expect(oversiktLysbilder(page)).toHaveCount(ANTALL);
    await expect(oversiktLysbilder(page).nth(3)).toHaveAttribute('aria-current', 'true');
    await expect(oversiktLysbilder(page).nth(3)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(oversiktLysbilder(page).nth(4)).toBeFocused();
    await page.keyboard.press('l');
    await expect(oversiktLysbilder(page).nth(5)).toBeFocused();
    await page.keyboard.press('h');
    await expect(oversiktLysbilder(page).nth(4)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(oversikt(page)).toBeHidden();
    await ventPåLysbilde(page, 5);
    await page.keyboard.press('o');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(oversikt(page)).toBeHidden();
    await ventPåLysbilde(page, 5);
  });

  test.fixme('TC-2-10-08 oversikten med mus: klikk på et lysbilde hopper dit', async ({ page }) => {
    await presenter(page, s.sti);
    await page.keyboard.press('o');
    await oversiktLysbilder(page).nth(9).click();
    await ventPåLysbilde(page, 10);
  });

  test.fixme('TC-2-10-09 `:` åpner paletten i present-modus; `:tema terminal` bytter tema uten å miste lysbildet', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 7);
    await kjørKommando(page, 'tema terminal');
    await expect(page.locator('html')).toHaveAttribute('data-type', 'terminal');
    await ventPåPresentasjon(page);
    await ventPåLysbilde(page, 7);
    await forventLerret169(page);
    await kjørKommando(page, 'mørk');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await ventPåLysbilde(page, 7);
    // ⌘. / Ctrl . virker også i present-modus (Q-11).
    await page.keyboard.press('Control+Period');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
    await ventPåLysbilde(page, 7);
  });

  test.fixme('TC-2-10-10 `:` med norsk tastatur (Shift+.) åpner paletten i present-modus', async ({ page }) => {
    await presenter(page, s.sti);
    await trykkNorsk(page, ':');
    await expect(page.locator('dialog[open]').getByRole('combobox')).toHaveValue(':');
  });

  test.fixme('TC-2-10-11 `?` i present-modus viser present-modusens taster (og ikke normal-modusens)', async ({ page }) => {
    await presenter(page, s.sti);
    await page.keyboard.press('Shift+Slash');
    const kort = hurtigtastoversikt(page);
    await expect(kort).toBeVisible();
    for (const gruppe of t.nyeGrupper) await expect(kort.getByRole('heading', { name: gruppe })).toBeVisible();
    const vist = (await kort.getByTestId('hurtigtast-binding').allInnerTexts()).map((x) => x.replace(/\s+/g, ''));
    for (const tast of ['j', 'k', 'n', 'p', 'o', 'b', 'PageDown', 'PageUp']) expect(vist.join(' '), tast).toContain(tast);
    await expect(kort).not.toContainText('za');
    await expect(kort).not.toContainText(/Space\s*w|␣\s*w/);
    await page.keyboard.press('Escape');
    await expect(kort).toBeHidden();
    await expect(presentasjon(page)).toBeVisible();
  });

  test.fixme('TC-2-10-12 fremdriftslinje og lysbildenummer («n / N») følger navigasjonen (A5)', async ({ page }) => {
    await presenter(page, s.sti);
    await expect(lysbildenummer(page)).toHaveText(new RegExp(`^\\s*1\\s*/\\s*${ANTALL}\\s*$`));
    await expect(fremdrift(page)).toHaveAttribute('aria-valuenow', '1');
    await expect(fremdrift(page)).toHaveAttribute('aria-valuemax', String(ANTALL));
    await gåTilLysbilde(page, 7);
    await expect(lysbildenummer(page)).toHaveText(new RegExp(`^\\s*7\\s*/\\s*${ANTALL}\\s*$`));
    await expect(fremdrift(page)).toHaveAttribute('aria-valuenow', '7');
  });

  test.fixme('TC-2-10-13 `Esc` midt i en sekvens (`g Esc`) avbryter bare sekvensen', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 3);
    await page.keyboard.press('g');
    await page.keyboard.press('Escape');
    await expect(presentasjon(page)).toBeVisible();
    await page.keyboard.press('g');
    await page.waitForTimeout(150);
    await ventPåLysbilde(page, 3);
  });
});

test.describe('AK-2-10 registeret (P2, P3, P4, P5)', () => {
  test.skip(({ isMobile }) => isMobile, 'Ren logikk – kjøres én gang');

  test.fixme('TC-2-10-20 present-modus finnes i registeret og dekker hele tastetabellen', async () => {
    const { kommandoer } = await lastRegister();
    const present = kommandoer.flatMap((k) => k.bindings.filter((b) => b.mode === t.presentModus));
    const vist = new Set(present.map((b) => visTrinn(b.steps)));
    const forventet = [...t.neste, ...t.forrige, ...t.forste, ...t.siste, ...t.oversikt, ...t.svart, ...t.palett, ...t.hjelp, ...t.avslutt].map((r) => visTrinn(parseBinding(r)));
    expect(forventet.filter((f) => !vist.has(f))).toEqual([]);
    // Start er en normal-modus-binding.
    const normal = new Set(kommandoer.flatMap((k) => k.bindings.filter((b) => b.mode === 'normal').map((b) => visTrinn(b.steps))));
    for (const st of t.start) expect(normal.has(visTrinn(parseBinding(st))), st).toBe(true);
  });

  test.fixme('TC-2-10-21 P4 i normal-modus, P5 i alle moduser, ingen konflikter innen present-modus', async () => {
    const { kommandoer } = await lastRegister();
    const alle = kommandoer.flatMap((k) => k.bindings);
    expect(alle.filter((b) => b.mode === 'normal').map(brytReservert).filter(Boolean), 'P4').toEqual([]);
    expect(alle.map(brytNorskTastatur).filter(Boolean), 'P5').toEqual([]);
    expect(konflikter(alle), 'konflikter').toEqual([]);
    // Esc i present-modus er «lukk/avslutt» (P4-ånd).
    const esc = alle.filter((b) => b.mode === t.presentModus && visTrinn(b.steps) === 'Escape');
    expect(esc.length).toBeGreaterThan(0);
    for (const b of esc) expect(`${b.commandId} ${b.commandName}`).toMatch(/lukk|avslutt|avbryt|close|exit|escape/i);
  });

  test.fixme('TC-2-10-22 nye kommandoer finnes i paletten: `:presenter`, `:agenda av` (P2)', async ({ page }) => {
    await openNote(page, s.sti);
    await page.keyboard.press(':');
    const felt = page.locator('dialog[open]').getByRole('combobox');
    for (const k of ['presenter', 'agenda']) {
      await felt.fill(`:${k}`);
      await expect(page.locator('dialog[open]').getByRole('option').first()).toContainText(k);
    }
  });
});

test.describe('AK-2-11 fullskjerm', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop');

  test.fixme('TC-2-11-01 start går i fullskjerm, Esc avslutter presentasjon og fullskjerm', async ({ page }) => {
    await openNote(page, s.sti);
    await startPresentasjon(page);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
    await avsluttPresentasjon(page);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  });

  test.fixme('TC-2-11-02 fullskjerm avvist (rejected promise): presentasjonen virker i vinduet, ingen feil', async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('Permissions check failed'));
    });
    await openNote(page, s.sti);
    await startPresentasjon(page);
    await forventLerret169(page);
    await page.keyboard.press('j');
    await ventPåLysbilde(page, 2);
    await avsluttPresentasjon(page);
    // Vaktene (guards) feiler testen ved uncaught rejection eller console.error.
  });

  test.fixme('TC-2-11-03 fullskjerm utilgjengelig (`fullscreenEnabled = false`, f.eks. iframe/Teams): ingen forsøk, ingen feil', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
      (window as unknown as { __fsKall: number }).__fsKall = 0;
      Element.prototype.requestFullscreen = function () {
        (window as unknown as { __fsKall: number }).__fsKall++;
        return Promise.reject(new TypeError('not allowed'));
      };
    });
    await openNote(page, s.sti);
    await startPresentasjon(page);
    expect(await page.evaluate(() => (window as unknown as { __fsKall: number }).__fsKall)).toBe(0);
    await forventLerret169(page);
  });

  test.fixme('TC-2-11-04 nettleseren går ut av fullskjerm (F11/Esc i nettleseren): presentasjonen fortsetter i vinduet (Q-10)', async ({ page }) => {
    await openNote(page, s.sti);
    await startPresentasjon(page);
    await gåTilLysbilde(page, 4);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
    await page.evaluate(() => document.exitFullscreen());
    await expect(presentasjon(page)).toBeVisible();
    await ventPåLysbilde(page, 4);
  });
});

test.describe('AK-2-11 URL og reload', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');

  test.fixme('TC-2-11-10 gjeldende lysbilde står i URL-en; reload holder lysbildet', async ({ page }) => {
    await presenter(page, s.sti);
    const start = page.url();
    await gåTilLysbilde(page, 5);
    await expect.poll(() => page.url()).not.toBe(start);
    const før = await lesLysbilde(page);
    await page.reload();
    await ventPåPresentasjon(page);
    await ventPåLysbilde(page, 5);
    expect(await lesLysbilde(page)).toEqual(før);
  });

  test.fixme('TC-2-11-11 URL-en kan åpnes i en ny fane og gir samme lysbilde (dyplenke)', async ({ page, context }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 8);
    const url = page.url();
    const ny = await context.newPage();
    await ny.goto(url);
    await ventPåPresentasjon(ny);
    await expect(lysbildeOverskrift(ny)).toHaveText('Flyt i presentasjonen');
    await ny.close();
  });

  test.fixme('TC-2-11-12 lysbildebytte lager ikke historikkoppføringer; Tilbake etter presentasjon går til forrige notat (Q-12)', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await openNote(page, s.sti);
    const lengde = await page.evaluate(() => history.length);
    await startPresentasjon(page);
    for (let i = 0; i < 5; i++) await page.keyboard.press('j');
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(lengde + 1);
    await avsluttPresentasjon(page);
    await page.goBack();
    if (await presentasjon(page).isVisible()) await page.goBack();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('Velkommen til testvaultet');
  });

  test.fixme('TC-2-11-13 ugyldig lysbilde i URL-en (for stort tall/ukjent overskrift) gir nærmeste lysbilde, ingen feil', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, 3);
    const url = new URL(page.url());
    for (const [k, v] of url.searchParams) if (/3|siden/i.test(v)) url.searchParams.set(k, '999');
    await page.goto(url.toString());
    await ventPåPresentasjon(page);
    expect((await nummer(page)).n).toBe(ANTALL);
  });

  test.fixme('TC-2-11-14 reload etter avsluttet presentasjon gir lesevisningen (ikke presentasjon)', async ({ page }) => {
    await presenter(page, s.sti);
    await avsluttPresentasjon(page);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(presentasjon(page)).toBeHidden();
  });
});

test.describe('AK-2-10 touch (mobil)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Kun mobil (touch)');

  test.fixme('TC-2-10-30 trykk på høyre/venstre del av lerretet gir neste/forrige', async ({ page }) => {
    await openNote(page, s.sti);
    await kjørKommando(page, 'presenter');
    await ventPåPresentasjon(page);
    const b = (await page.getByTestId('lerret').boundingBox())!;
    await page.touchscreen.tap(b.x + b.width * 0.85, b.y + b.height / 2);
    await ventPåLysbilde(page, 2);
    await page.touchscreen.tap(b.x + b.width * 0.15, b.y + b.height / 2);
    await ventPåLysbilde(page, 1);
  });

  test.fixme('TC-2-10-31 sveip mot venstre gir neste, mot høyre forrige', async ({ page }) => {
    await openNote(page, s.sti);
    await kjørKommando(page, 'presenter');
    await ventPåPresentasjon(page);
    const b = (await page.getByTestId('lerret').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const sveip = async (fra: number, til: number) => {
      const y = b.y + b.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fra, y }] });
      for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: fra + ((til - fra) * i) / 5, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await sveip(b.x + b.width * 0.8, b.x + b.width * 0.2);
    await ventPåLysbilde(page, 2);
    await sveip(b.x + b.width * 0.2, b.x + b.width * 0.8);
    await ventPåLysbilde(page, 1);
    await cdp.detach();
  });

  test.fixme('TC-2-10-32 presentasjonen kan avsluttes uten tastatur («Avslutt presentasjon», P6)', async ({ page }) => {
    await openNote(page, s.sti);
    await kjørKommando(page, 'presenter');
    await ventPåPresentasjon(page);
    await page.getByRole('button', { name: 'Avslutt presentasjon' }).tap();
    await expect(presentasjon(page)).toBeHidden();
  });
});

