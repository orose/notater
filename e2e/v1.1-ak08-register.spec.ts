// AK-1.1-08 Ingen reserverte taster (P4) og ingen ⌥-avhengige taster (P5) er bundet – automatisk test mot
// kommandoregisteret (P2). Testplan: TC-08-*.
//
// Del 1 (aktiv nå): selvtest av reglene i e2e/support/keymap-rules.ts, så vi vet at sjekken faktisk fanger brudd.
// Del 2 (aktiv): sjekken mot registeret via `catalogBindings()` (ADR-007), med QAs egen parser – en
//   uavhengig kontroll av arkitektens `validateBindings` (commands/model/catalog.test.ts).
// Del 3 (fixme): samme sjekk mot det brukeren ser i `?`-oversikten (fanger bindinger utenfor registeret).
import { expect, openNote, test } from './support/guards';
import {
  brytNorskTastatur,
  brytReservert,
  konflikter,
  lastRegister,
  normaliserRegister,
  parseBinding,
  visTrinn,
  type Binding,
} from './support/keymap-rules';
import { fasit, fokusPåInnhold, hurtigtastoversikt } from './support/v11';

const b = (raw: string, id = 'x', name = 'X', mode = 'normal'): Binding => ({ commandId: id, commandName: name, mode, raw, steps: parseBinding(raw) });

test.describe('AK-1.1-08 selvtest av tastereglene (kjører nå)', () => {
  test.skip(({ isMobile }) => isMobile, 'Ren logikk – kjøres én gang');

  test('TC-08-01 parser vanlige notasjoner', () => {
    expect(visTrinn(parseBinding('Space w'))).toBe('Space w');
    expect(visTrinn(parseBinding('gg'))).toBe('g g');
    expect(visTrinn(parseBinding('g g'))).toBe('g g');
    expect(visTrinn(parseBinding('zM'))).toBe('z M');
    expect(visTrinn(parseBinding('Ctrl+d'))).toBe('Ctrl+d');
    expect(visTrinn(parseBinding('⌘K'))).toBe('Meta+K');
    expect(visTrinn(parseBinding('Mod+k'))).toBe('Mod+k');
    expect(visTrinn(parseBinding(['Space', 'd']))).toBe('Space d');
    expect(visTrinn(parseBinding({ key: 'd', ctrlKey: true }))).toBe('Ctrl+d');
    expect(visTrinn(parseBinding('Esc'))).toBe('Escape');
    expect(visTrinn(parseBinding('?'))).toBe('?');
    expect(visTrinn(parseBinding(':'))).toBe(':');
    expect(visTrinn(parseBinding('Ctrl++'))).toBe('Ctrl++');
  });

  test('TC-08-02 tastaturkartet i spesifikasjonen er lovlig', () => {
    const lovlige = [...fasit.tastaturkart.bindinger, '⌘K', '⌘.', 'Mod+k'].map((raw, i) => b(raw, `k${i}`));
    expect(lovlige.map(brytReservert).filter(Boolean)).toEqual([]);
    expect(lovlige.map(brytNorskTastatur).filter(Boolean)).toEqual([]);
    expect(konflikter(lovlige)).toEqual([]);
  });

  test('TC-08-03 fanger reserverte taster (P4), også med Shift og store bokstaver', () => {
    for (const raw of ['i', 'a', 'o', 'e', 'I', 'A', 'O', 's', 'c', 'd', 'x', 'p', 'y', 'u', 'r', 'd d', 'Shift+a', 'Shift+i']) {
      expect(brytReservert(b(raw)), raw).not.toBeNull();
    }
    // Ikke reservert: store varianter som ikke er listet, andre trinn i en sekvens, med Ctrl.
    for (const raw of ['S', 'D', 'X', 'z a', 'Space d', 'Ctrl+d', 'Ctrl+u', 'g g']) expect(brytReservert(b(raw)), raw).toBeNull();
  });

  test('TC-08-04 Esc er bare lov for lukk/avbryt', () => {
    expect(brytReservert(b('Esc', 'zen.toggle', 'Zen-modus'))).toBeNull();
    expect(brytReservert(b('Escape', 'dialog.close', 'Lukk dialog'))).toBeNull();
    expect(brytReservert(b('Esc', 'view.width', 'Bytt lesebredde'))).not.toBeNull();
  });

  test('TC-08-05 fanger ⌥-avhengige tegn og døde taster (P5)', () => {
    for (const raw of ['[', ']', '{', '}', '\\', '|', '@', '$', '~', 'Space [', 'g ]', 'Alt+j', '⌥8', '^', '`', '´', '¨']) {
      expect(brytNorskTastatur(b(raw)), raw).not.toBeNull();
    }
    for (const raw of [':', '?', '/', 'Shift+G', 'Ctrl+d', '⌘.']) expect(brytNorskTastatur(b(raw)), raw).toBeNull();
  });

  test('TC-08-06 fanger duplikater og uoppnåelige sekvenser', () => {
    expect(konflikter([b('j', 'a'), b('j', 'b')])).toHaveLength(1);
    expect(konflikter([b('g', 'a'), b('g g', 'b')])).toHaveLength(1);
    expect(konflikter([b('j', 'a', 'A', 'normal'), b('j', 'b', 'B', 'insert')])).toEqual([]);
    expect(konflikter([b('Esc', 'lukk.palett'), b('Esc', 'zen.av')])).toEqual([]);
  });

  test('TC-08-07 normaliserer ulike registerformer', () => {
    const array = normaliserRegister([{ id: 'view.width', name: 'Bytt lesebredde', group: 'Visning', keys: { normal: ['Space w'] } }]);
    expect(array[0]?.bindings.map((x) => visTrinn(x.steps))).toEqual(['Space w']);
    const record = normaliserRegister({ zen: { id: 'zen', title: 'Zen', bindings: [{ mode: 'normal', keys: 'Space z' }] } });
    expect(record[0]?.bindings[0]?.mode).toBe('normal');
    const map = normaliserRegister(new Map([['top', { id: 'top', label: 'Til toppen', shortcuts: ['gg'] }]]));
    expect(map[0]?.bindings.map((x) => visTrinn(x.steps))).toEqual(['g g']);
    expect(() => normaliserRegister({ ingenting: 1 })).toThrow();
  });
});

test.describe('AK-1.1-08 registeret (P2, P4, P5)', () => {
  test.skip(({ isMobile }) => isMobile, 'Ren logikk – kjøres én gang');

  test('TC-08-08 ingen reserverte taster, ingen ⌥-taster og ingen konflikter i registeret', async () => {
    const register = await lastRegister();
    const kommandoer = register.kommandoer;
    const bindinger = kommandoer.flatMap((k) => k.bindings);
    expect(bindinger.length, `${register.fil}: bindinger funnet`).toBeGreaterThan(15);
    const normal = bindinger.filter((x) => x.mode === 'normal');
    expect(normal.map(brytReservert).filter(Boolean), 'P4').toEqual([]);
    expect(bindinger.map(brytNorskTastatur).filter(Boolean), 'P5').toEqual([]);
    expect(konflikter(bindinger), 'konflikter').toEqual([]);
  });

  test('TC-08-09 registeret dekker hele tastaturkartet i spesifikasjonen, og bare kjente modi', async () => {
    const { kommandoer } = await lastRegister();
    const alle = new Set(kommandoer.flatMap((k) => k.bindings.filter((x) => x.mode === 'normal').map((x) => visTrinn(x.steps))));
    const forventet = fasit.tastaturkart.bindinger.map((raw) => visTrinn(parseBinding(raw)));
    expect(forventet.filter((f) => !alle.has(f))).toEqual([]);
    // P3: i v1.1 finnes bare normal-modus.
    expect([...new Set(kommandoer.flatMap((k) => k.bindings.map((x) => x.mode)))]).toEqual(['normal']);
    // P2: hver kommando har id, navn og gruppe fra oversiktens grupper.
    for (const k of kommandoer) expect(fasit.tastaturkart.grupper, `${k.id}.group`).toContain(k.group);
    expect(new Set(kommandoer.map((k) => k.id)).size, 'unike id-er').toBe(kommandoer.length);
  });
});

test.describe('AK-1.1-08 det brukeren ser i ?-oversikten', () => {
  test.skip(({ isMobile }) => isMobile, 'Tastatur testes på desktop');

  test.fixme('TC-08-10 ingen viste bindinger bruker reserverte taster eller ⌥', async ({ page }) => {
    await openNote(page, 'Velkommen');
    await fokusPåInnhold(page);
    await page.keyboard.press('Shift+Slash');
    const kbd = await hurtigtastoversikt(page).getByTestId('hurtigtast-binding').allInnerTexts();
    expect(kbd.length).toBeGreaterThan(15);
    const bindinger = kbd.map((tekst, i) => b(tekst.replace(/\s+/g, ' ').trim(), `vist${i}`, tekst));
    expect(bindinger.map(brytReservert).filter(Boolean)).toEqual([]);
    expect(bindinger.map(brytNorskTastatur).filter(Boolean)).toEqual([]);
    await expect(hurtigtastoversikt(page)).not.toContainText(/⌥|Alt\b|Option/);
  });
});
