// AK-2-10 Alle taster i tabellen virker; `?` viser present-modusens taster; reserverte/⌥-taster er ikke bundet
//         (test mot registeret).
// AK-2-11 Fullskjerm startes/avsluttes; reload beholder lysbildet via URL.
// Også: klikker-taster, Space i present-modus mot leader, svart skjerm, oversikt, fremdrift (A5), touch,
// temabytte og avvist fullskjerm. Testplan: TC-2-10-*, TC-2-11-*. TDD: `test.fixme` til levert.
import { expect, noteUrl, openNote, test } from './support/guards';
import { brytNorskTastatur, brytReservert, konflikter, lastRegister, parseBinding, visTrinn } from './support/keymap-rules';
import {
  avsluttPresentasjon,
  fasit2,
  forventLerret169,
  fremdrift,
  gåTilLysbilde,
  lesLysbilde,
  lysbildenummer,
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
    test(`TC-2-10-01 «${tast}» gir neste lysbilde, og stopper på siste`, async ({ page }) => {
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
    test(`TC-2-10-02 «${tast}» gir forrige lysbilde, og stopper på første`, async ({ page }) => {
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

  test('TC-2-10-03 `gg` og `G` går til første og siste lysbilde', async ({ page }) => {
    await presenter(page, s.sti);
    await page.keyboard.press('Shift+G');
    await ventPåLysbilde(page, ANTALL);
    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await ventPåLysbilde(page, 1);
  });

  test('TC-2-10-04 klikker-taster (PageDown/PageUp, `.`, `b`) uten fokus på noe spesielt', async ({ page }) => {
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

  test('TC-2-10-05 Space i present-modus er «neste», ikke leader: ingen which-key, ingen forsinkelse', async ({ page }) => {
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

  test('TC-2-10-06 `b` og `.` gir svart skjerm av/på; neste/forrige mens svart gir bildet tilbake uten å bla (ADR-010 §3)', async ({ page }) => {
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
    for (const tast of ['j', 'k']) {
      await page.keyboard.press('b');
      await expect(svartSkjerm(page)).toBeVisible();
      await page.keyboard.press(tast);
      await expect(svartSkjerm(page)).toBeHidden();
      await ventPåLysbilde(page, 4);
    }
    // Svart skjerm huskes ikke: reload gir lysbildet.
    await page.keyboard.press('b');
    await page.reload();
    await ventPåPresentasjon(page);
    await expect(svartSkjerm(page)).toBeHidden();
  });

  test('TC-2-10-07 `o` åpner oversikten med gjeldende uthevet; piltaster/hjkl + Enter hopper; Esc lukker', async ({ page }) => {
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

  test('TC-2-10-08 oversikten med mus: klikk på et lysbilde hopper dit', async ({ page }) => {
    await presenter(page, s.sti);
    await page.keyboard.press('o');
    await oversiktLysbilder(page).nth(9).click();
    await ventPåLysbilde(page, 10);
  });

  test('TC-2-10-09 `:` åpner paletten i present-modus; `:tema terminal` bytter tema uten å miste lysbildet', async ({ page }) => {
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

  test('TC-2-10-10 `:` med norsk tastatur (Shift+.) åpner paletten i present-modus', async ({ page }) => {
    await presenter(page, s.sti);
    await trykkNorsk(page, ':');
    await expect(page.locator('dialog[open]').getByRole('combobox')).toHaveValue(':');
  });

  test('TC-2-10-11 `?` i present-modus viser present-modusens taster (og ikke normal-modusens)', async ({ page }) => {
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

  test('TC-2-10-12 fremdriftslinje og lysbildenummer («n / N») følger navigasjonen (A5)', async ({ page }) => {
    await presenter(page, s.sti);
    await expect(lysbildenummer(page)).toHaveText(new RegExp(`^\\s*1\\s*/\\s*${ANTALL}\\s*$`));
    await expect(fremdrift(page)).toHaveAttribute('aria-valuenow', '1');
    await expect(fremdrift(page)).toHaveAttribute('aria-valuemax', String(ANTALL));
    await gåTilLysbilde(page, 7);
    await expect(lysbildenummer(page)).toHaveText(new RegExp(`^\\s*7\\s*/\\s*${ANTALL}\\s*$`));
    await expect(fremdrift(page)).toHaveAttribute('aria-valuenow', '7');
  });

  test('TC-2-10-13 `Esc` midt i en sekvens (`g Esc`) avbryter bare sekvensen', async ({ page }) => {
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

  test('TC-2-10-20 present-modus finnes i registeret og dekker hele tastetabellen (inkl. `f`, PO-88)', async () => {
    const { kommandoer } = await lastRegister();
    const present = kommandoer.flatMap((k) => k.bindings.filter((b) => b.mode === t.presentModus));
    const vist = new Set(present.map((b) => visTrinn(b.steps)));
    const forventet = [...t.neste, ...t.forrige, ...t.forste, ...t.siste, ...t.oversikt, ...t.svart, ...t.fullskjerm, ...t.palett, ...t.hjelp, ...t.avslutt].map((r) => visTrinn(parseBinding(r)));
    expect(forventet.filter((f) => !vist.has(f))).toEqual([]);
    // Start er en normal-modus-binding.
    const normal = new Set(kommandoer.flatMap((k) => k.bindings.filter((b) => b.mode === 'normal').map((b) => visTrinn(b.steps))));
    for (const st of t.start) expect(normal.has(visTrinn(parseBinding(st))), st).toBe(true);
  });

  test('TC-2-10-21 P4-bokstavene bare i normal-modus (PO-84), P5 og Esc-regelen i alle moduser, ingen konflikter innen present-modus', async () => {
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

  test('TC-2-10-22 nye kommandoer finnes i paletten: `:presenter`, `:agenda av` (P2)', async ({ page }) => {
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

  test('TC-2-11-01 start går i fullskjerm, Esc avslutter presentasjon og fullskjerm', async ({ page }) => {
    await openNote(page, s.sti);
    await startPresentasjon(page);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
    await avsluttPresentasjon(page);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  });

  test('TC-2-11-02 fullskjerm avvist (rejected promise): presentasjonen virker i vinduet, ingen feil', async ({ page }) => {
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

  test('TC-2-11-03 fullskjerm utilgjengelig (`fullscreenEnabled = false`, f.eks. iframe/Teams): presentasjonen virker, ingen feil', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
      Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('not allowed'));
    });
    await openNote(page, s.sti);
    await startPresentasjon(page);
    await forventLerret169(page);
    await page.keyboard.press('j');
    await ventPåLysbilde(page, 2);
  });

  test('TC-2-11-04 `f` og `:fullskjerm` slår fullskjerm av og på uten å avslutte presentasjonen (PO-88)', async ({ page }) => {
    await openNote(page, s.sti);
    await startPresentasjon(page);
    await gåTilLysbilde(page, 4);
    const iFullskjerm = () => page.evaluate(() => document.fullscreenElement !== null);
    await expect.poll(iFullskjerm).toBe(true);
    await page.keyboard.press('f');
    await expect.poll(iFullskjerm).toBe(false);
    await expect(presentasjon(page)).toBeVisible();
    await ventPåLysbilde(page, 4);
    await page.keyboard.press('f');
    await expect.poll(iFullskjerm).toBe(true);
    await kjørKommando(page, 'fullskjerm');
    await expect.poll(iFullskjerm).toBe(false);
    await ventPåLysbilde(page, 4);
  });

  test('TC-2-11-05 fullskjerm forlatt utenfra (nettleserens Esc/F11): oversikt lukkes, presentasjonen fortsetter med toast (PO-92)', async ({ page }) => {
    await openNote(page, s.sti);
    await startPresentasjon(page);
    await gåTilLysbilde(page, 4);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
    await page.keyboard.press('o');
    await expect(oversikt(page)).toBeVisible();
    await page.evaluate(() => document.exitFullscreen());
    await expect(oversikt(page)).toBeHidden();
    await expect(presentasjon(page)).toBeVisible();
    await ventPåLysbilde(page, 4);
    await page.keyboard.press('f');
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
    // PO-92 (etter ADR-010): nettleseren tar første Esc; presentasjonen fortsetter med toasten «Esc igjen avslutter».
    // Endret av frontend: testen forventet tidligere at presentasjonen ble avsluttet.
    await page.evaluate(() => document.exitFullscreen());
    await expect(page.getByRole('status').filter({ hasText: /Esc igjen avslutter/ })).toBeVisible();
    await expect(presentasjon(page)).toBeVisible();
    await ventPåLysbilde(page, 4);
    await avsluttPresentasjon(page);
  });

  test('TC-2-11-06 reload under presentasjon: fullskjerm er av, toast med hint om `f`/`:fullskjerm` (PO-88)', async ({ page }) => {
    await openNote(page, s.sti);
    await startPresentasjon(page);
    await gåTilLysbilde(page, 3);
    await page.reload();
    await ventPåPresentasjon(page);
    await expect(page.getByRole('status').filter({ hasText: /Fullskjerm/ })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /Fullskjerm/ })).toContainText(/\bf\b|:fullskjerm/);
  });
});

test.describe('AK-2-11 URL og reload', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur');
  const param = (url: string): string | null => new URL(url).searchParams.get('lysbilde');

  test('TC-2-11-10 gjeldende lysbilde står i URL-en (`?lysbilde=<id>`); reload holder lysbildet', async ({ page }) => {
    await presenter(page, s.sti);
    await expect.poll(() => param(page.url())).toBe('tittel');
    await gåTilLysbilde(page, 7);
    await expect.poll(() => param(page.url())).toBe('oppgaver');
    const før = await lesLysbilde(page);
    await page.reload();
    await ventPåPresentasjon(page);
    await ventPåLysbilde(page, 7);
    expect(await lesLysbilde(page)).toEqual(før);
  });

  test('TC-2-11-11 dyplenker med lysbilde-id-er (ADR-010 §4) åpner riktig lysbilde i ny fane', async ({ page }) => {
    for (const [n, ider] of [[s, s.urlIder], [fasit2.delte, fasit2.delte.urlIder]] as const) {
      for (const [id, nr] of Object.entries(ider)) {
        await page.goto(`${noteUrl(n.sti)}?lysbilde=${encodeURIComponent(id)}`);
        await ventPåPresentasjon(page);
        await ventPåLysbilde(page, nr);
        await expect.poll(() => param(page.url()), id).toBe(id);
      }
    }
  });

  test('TC-2-11-12 lysbildebytte lager ikke historikkoppføringer; Tilbake avslutter, Frem går inn igjen på samme lysbilde', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await openNote(page, s.sti);
    const lengde = await page.evaluate(() => history.length);
    await startPresentasjon(page);
    for (let i = 0; i < 5; i++) await page.keyboard.press('j');
    await ventPåLysbilde(page, 6);
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(lengde + 1);
    await page.goBack();
    await expect(presentasjon(page)).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(s.tittel!);
    await page.goForward();
    await ventPåPresentasjon(page);
    await ventPåLysbilde(page, 6);
    await avsluttPresentasjon(page);
    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText('Velkommen til testvaultet');
  });

  test('TC-2-11-13 ukjent lysbilde-id i URL-en ved ny lasting gir tittellysbildet, ingen feil (PO-91)', async ({ page }) => {
    await page.goto(`${noteUrl(s.sti)}?lysbilde=${fasit2.ukjentUrlId.id}`);
    await ventPåPresentasjon(page);
    await ventPåLysbilde(page, fasit2.ukjentUrlId.gir);
    await expect.poll(() => param(page.url())).toBe('tittel');
  });

  test('TC-2-11-14 reload etter avsluttet presentasjon gir lesevisningen (ikke presentasjon)', async ({ page }) => {
    await presenter(page, s.sti);
    await avsluttPresentasjon(page);
    expect(param(page.url())).toBeNull();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(presentasjon(page)).toBeHidden();
  });

  test('TC-2-11-15 `?lysbilde` på en `.base`-side ignoreres', async ({ page }) => {
    await page.goto(`${noteUrl('Oppgaver.base')}?lysbilde=tittel`);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(presentasjon(page)).toBeHidden();
  });

  test('TC-2-11-16 lenke på et lysbilde åpner målet og forlater presentasjonen; Tilbake går inn igjen (PO-89)', async ({ page }) => {
    await presenter(page, s.sti);
    await gåTilLysbilde(page, s.lenke.lysbilde);
    await presentasjon(page).getByRole('link', { name: s.lenke.tekst }).click();
    await expect(presentasjon(page)).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 }).first()).toHaveText(s.lenke.tekst);
    await page.goBack();
    await ventPåPresentasjon(page);
    await ventPåLysbilde(page, s.lenke.lysbilde);
  });
});

test.describe('AK-2-10 touch (mobil)', () => {
  test.skip(({ isMobile }) => !isMobile, 'Kun mobil (touch)');

  test('TC-2-10-30 trykk på høyre/venstre del av lerretet gir neste/forrige', async ({ page }) => {
    await openNote(page, s.sti);
    await kjørKommando(page, 'presenter');
    await ventPåPresentasjon(page);
    const b = (await page.getByTestId('lerret').boundingBox())!;
    await page.touchscreen.tap(b.x + b.width * 0.85, b.y + b.height / 2);
    await ventPåLysbilde(page, 2);
    await page.touchscreen.tap(b.x + b.width * 0.15, b.y + b.height / 2);
    await ventPåLysbilde(page, 1);
  });

  test('TC-2-10-31 sveip mot venstre gir neste, mot høyre forrige', async ({ page }) => {
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

  test('TC-2-10-32 presentasjonen kan avsluttes uten tastatur («Avslutt presentasjon», P6)', async ({ page }) => {
    await openNote(page, s.sti);
    await kjørKommando(page, 'presenter');
    await ventPåPresentasjon(page);
    await page.getByRole('button', { name: 'Avslutt presentasjon' }).tap();
    await expect(presentasjon(page)).toBeHidden();
  });
});

