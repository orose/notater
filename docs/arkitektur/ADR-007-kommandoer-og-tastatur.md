# ADR-007: Kommandoregister, tastaturmotor og felles palett

- Status: Vedtatt (arkitekt), 2026-11-06. Gjelder v1.1 (`docs/produkt/v1.1-spesifikasjon.md`, P2–P7, F5–F7).
- Skjelett: `src/web/features/keyboard/` og `src/web/features/commands/` (kompilerer, har tester).

## Kontekst

I v1 lytter tre komponenter selv på `keydown`: `SearchProvider` (⌘K), `ThemeProvider` (⌘.) og lokale
Esc-lyttere (skuff, vault-meny). v1.1 legger til vim-lignende taster, leader, sekvenser og en
kommandopalett, og krever at **alt** kommer fra ett register (P2), at motoren har modi fra start (P3), at
reserverte og ⌥-avhengige taster aldri bindes (P4/P5, testet), og at taster er inaktive i tekstfelt og
bak modale dialoger (P7).

## Beslutning

### 1. Kommandoregisteret: statisk katalog + handlere

Registeret har to deler med én felles id:

| Del | Fil | Innhold | Hvorfor egen del |
|---|---|---|---|
| **Katalog** | `commands/model/catalog.ts` | `id`, `name`, `aliases`, `group`, `description`, `args` (navn/etikett), `bindings` per modus, `hint` (which-key), `inPalette` | Ren data. Leses av paletten, `?`-oversikten, which-key, policytesten **og** README-generatoren i Node – uten React. |
| **Handlere** | React-laget (`CommandProvider`, slice 1.1-a) | `isEnabled(ctx)`, `argumentValues(ctx, navn)`, `run(ctx, args)` | Trenger router, tema, visningstilstand osv. |

`createCommandRegistry(handlers: CommandHandlers)` setter dem sammen. `CommandHandlers` er
`{ [K in CommandId]: CommandHandler }`, så en kommando uten handler (eller en handler uten kommando) er en
**typefeil**. `CommandId` utledes av katalogen (`keyof typeof COMMAND_CATALOG`).

Datamodell (`commands/model/command-types.ts`):

```ts
interface CommandSpecBody {
  name: string;                 // «Bytt lesebredde»
  aliases: readonly string[];   // ':'-ord uten kolon: 'bredde', 'fold alle'
  group: 'navigasjon' | 'lesing' | 'visning' | 'sok';
  description: string;
  args?: readonly { name: string; label: string }[];          // høyst ett i v1.1
  bindings: Partial<Record<KeyMode, readonly BindingSpec[]>>;  // P3
  hint?: string;                // kort etikett i which-key
  inPalette?: boolean;          // false for system.escape og palette.commands
}
interface BindingSpec { keys: string; repeat?: boolean; inTextFields?: boolean }
type Availability = { enabled: true } | { enabled: false; reason: string };
interface CommandHandler {
  isEnabled?(ctx: CommandContext): Availability;            // standard: tilgjengelig
  argumentValues?(ctx: CommandContext, name: string): readonly ArgumentValue[];
  run(ctx: CommandContext, args: Readonly<Record<string, string>>): void | Promise<void>;
}
```

- **`isEnabled` returnerer alltid en begrunnelse** når kommandoen ikke kan brukes (F5: «vises deaktivert
  med forklaring»). Eksempler: diskré embedding på en `.base`-side → «Gjelder bare notater»; på et notat
  uten innebygde notater → fortsatt tilgjengelig (valget huskes og gjelder når embeds legges til), men
  toasten sier «Ingen innebygde notater i dette notatet». Folding uten overskrifter → «Notatet har ingen
  overskrifter». Paletten viser deaktiverte kommandoer dempet med begrunnelsen; en tast som treffer en
  deaktivert kommando viser begrunnelsen som toast og gjør ellers ingenting.
- **`CommandContext`** (`command-context.ts`) = `{ mode, route, view, ports }`. `route` sier hva som vises
  (`note`/`base`/`asset`/`home`/`missing`/`loading`); `view` er et øyeblikksbilde av ADR-008-tilstanden og
  disposisjonen (antall notat-embeds og foldbare overskrifter); `ports` er smale grensesnitt mot det
  kommandoene styrer (rulling, historikk, palett, hjelp, Utseende, tema, visning, disposisjon, toast).
  Kommandoer importerer aldri andre features direkte – `CommandProvider` bygger portene fra
  eksisterende kontekster. Det holder katalogen ren og gjør `run` testbar med falske porter.
- **Argumenter** (`:tema terminal`, `:palett fosfor`): katalogen navngir argumentet; verdiene kommer fra
  `argumentValues` (temaets lister), slik at katalogen ikke importerer `theme`. Fra tastaturet kjøres
  kommandoer uten argumenter; en argumentkommando uten verdi åpner paletten på argumentlisten.
- `:lys` og `:mørk` er egne kommandoer (`theme.light`/`theme.dark`) uten taster, ikke argumenter.
- `system.escape` er en vanlig kommando (Esc), slik at også Esc står i registeret og oversikten (P2).

### 2. Tastaturmotoren: modi, sekvenser, leader

`keyboard/` er en ren tilstandsmaskin (`key-engine.ts`, kun typer i skjelettet) pluss en tynn DOM-adapter.

- **Modi (P3).** `KEY_MODES = ['normal']`. Tastaturkartet er `Record<KeyMode, EngineBinding[]>`, og
  `BindingSpec`-er ligger per modus i katalogen. `insert` legges til ved å utvide `KEY_MODES`, gi
  kommandoer `bindings.insert` og la `system.escape` gå til `normal` når `mode !== 'normal'`.
  Motoren har `setMode`; i v1.1 kalles den aldri.
- **Notasjon** (`key-notation.ts`): akkorder skilt av mellomrom: `'j'`, `'G'`, `'g g'`, `'z a'`,
  `'Leader w'`, `'Mod+k'`, `'Ctrl+d'`, `'Escape'`. `Mod` = ⌘ på Apple, Ctrl ellers, og **begge virker
  overalt** (PO-36). `Leader` utvides til `Space`. Visning: `gg`, `za`, `Space w`, `⌘K`/`Ctrl K`,
  `Ctrl d` (`formatKeySequence`, plattform `apple`/`other`/`docs`).
- **Entydighet uten venting.** Policyen forbyr at en sekvens er prefiks av en annen i samme modus. Derfor
  er et tastetrykk enten et fullt treff (kjør nå), et prefiks (vent) eller ingenting – motoren trenger
  aldri tidsavbrudd for å *velge* mellom `g` og `gg`.
- **Tidsavbrudd.** En påbegynt sekvens (`g`, `z`) avbrytes etter `SEQUENCE_TIMEOUT_MS = 1000`. Esc
  avbryter også (resultat `cancelled`, ingen kommando). Det samme gjør blur av vinduet, navigasjon og at
  en modal åpnes.
- **Leader og which-key (F7).** Etter `Space` venter motoren. Kommer ingen tast innen
  `WHICH_KEY_DELAY_MS = 400`, settes `pending.showHints = true` og React-laget viser which-key (alle
  fortsettelser med `hint`/navn). **Mens which-key vises, løper ikke tidsavbruddet** – ellers ville hintet
  forsvinne etter 0,6 s. Hintet lukkes av neste tast (som kjøres hvis den er gyldig), Esc eller klikk.
  For `g`/`z` vises ikke which-key i v1.1 (motoren støtter det; spesifikasjonen ber bare om leader).
- **Repetisjon.** `event.repeat` ignoreres unntatt for bindinger med `repeat: true` (`j`, `k`, `Ctrl d/u`).
- **Rulling** bruker `window.scrollBy`/`scrollTo` med `behavior: 'smooth'` bare når
  `prefers-reduced-motion` ikke er satt. `j/k` = 3 × brødtekstens linjehøyde (`getComputedStyle` på
  `.prose`), `Ctrl d/u` = halv `innerHeight`. `Space` ruller ikke lenger (den er leader).

### 3. DOM-adapter: P7, Esc-rekkefølge og norsk tastatur

Én `keydown`-lytter på **`window` i boblefasen** (montert av `CommandProvider`). Lokale lyttere på
`document` og elementer kjører først og kan konsumere tasten med `preventDefault()`. Rekkefølge per trykk:

1. `event.defaultPrevented` → ignorer (en komponent har allerede håndtert tasten, f.eks. Esc i skuffen).
2. **Modal åpen** (`hasOpenModal`: `dialog[open]` eller `[aria-modal=true]`) → motoren er helt inaktiv
   (P7). Dialogen eier sine egne taster og Esc (native `<dialog>`). Paletten håndterer selv ⌘K (lukk),
   hjelpeoversikten selv `?` (lukk).
3. **Tekstfelt** (`isTextEntryTarget`: tekst-`input`, `textarea`, `select`, contenteditable,
   `role=textbox|searchbox|combobox|spinbutton`) → kun bindinger med `inTextFields: true`. Policyen
   tillater det bare for én Mod/Ctrl-akkord (i dag ⌘K og ⌘.), så bokstaver aldri stjeles.
4. **Space på et aktiverbart element** (`isSpaceActivationTarget`: `button`, `summary`, avkrysning,
   `role=button|tab|option|treeitem|…`) → ikke leader; Space beholder sin native betydning
   (tilgjengelighet: tastaturbrukere aktiverer knapper med Space). På lenker og i brødtekst er Space leader.
5. Ellers: `chordCandidates(event)` → `engine.handle(...)`. `handled`/`pending`/`cancelled` ⇒
   `preventDefault()`.

**Norsk Mac-layout** (`key-input.ts`). Vi bruker `event.key`, aldri `event.code`: `code` beskriver fysisk
posisjon (US-oppsett) og ville gitt `Period`, `Digit7`, `Minus` for `:` `/` `?`. Konsekvenser:

- På norsk Mac er `:` = Shift+`.`, `/` = Shift+`7`, `?` = Shift+`+`. `event.key` er da `:`/`/`/`?` med
  `shiftKey = true`. **Shift er derfor aldri en del av akkorden for tegn** – den er «brukt opp» i tegnet.
  Bindinger skrives med tegnet (`'?'`, `'G'`); notasjonen avviser `Shift+g`. Samme binding virker på
  US-oppsett (Shift+`/`) uten endring.
- **Bokstaver** får stor/liten etter `shiftKey`, ikke etter Caps Lock (Caps Lock + `g` er fortsatt `g`,
  ikke «til bunnen»).
- Med ⌘/Ctrl brukes liten bokstav og Shift tas med (`Mod+Shift+k`), så ⌘K virker også med Caps Lock.
- **⌥** gir andre tegn (⌥8 = `[`). Alt tas med i akkorden (`Alt+[`), og ingen binding har Alt, så slike
  trykk treffer aldri. **Døde taster** (`^ ´ ¨ \``) gir `event.key === 'Dead'` og ignoreres, det samme gjør
  IME-komposisjon (`isComposing`).
- Ctrl+bokstav på Windows/Linux gir både `Ctrl+x` og `Mod+x` som kandidater. Policyen forbyr derfor å
  binde både `Mod+x` og `Ctrl+x`. `Ctrl d`/`Ctrl u` er bokstavelig Control også på Mac (som i vim), ikke ⌘
  (⌘D er bokmerke i nettleseren).

**Policy (AK-1.1-08)** – `validateBindings` (`key-policy.ts`) kjøres mot hele katalogen i
`commands/model/catalog.test.ts`:

| Regel | Hva |
|---|---|
| P4 | Første akkord i normal-modus kan ikke være en reservert tast **uten modifikator** (`i a o e I A O s c d x p y u r`). `Space d`, `z a` og `Ctrl d` er lov. |
| P4 | `Escape` kun for `system.escape`. |
| P5 | Ingen `Alt`. Tegn må stå på hvitelisten `P5_SAFE_CHARACTERS` (a–z, A–Z, 0–9, `. , - : ; / ? + ! " # % & ( ) = * ' _`). Hviteliste fordi «bl.a.» i P5 gjør en svarteliste ufullstendig. |
| Entydighet | Ingen duplikater, ingen prefiks-konflikter, ikke både `Mod+x` og `Ctrl+x`. |
| P7 | `inTextFields` kun på én Mod/Ctrl-akkord. |

QA har en egen, tolerant variant i `e2e/support/keymap-rules.ts`. Den bør importere katalogen
(`catalogBindings()` fra `src/web/features/commands`) i stedet for å gjette formen; reglene er de samme.

### 4. Felles palett (F5)

`CommandPalette` (search-featuren) blir én palett med to modi, avgjort av inndata (`paletteModeOf`):

| Inndata | Modus | Innhold |
|---|---|---|
| tom / tekst | søk | Som i dag: nylig åpnet, notater, innhold (server-søk) |
| `:…` | kommandoer | Registeret, fuzzy på `name` + `aliases`, deaktiverte dempet med begrunnelse, binding til høyre |
| `:tema ` / valgt argumentkommando | argument | Verdiene fra `argumentValues`, gjeldende markert |

- `⌘K` og `/` åpner paletten tom (søk), `:` åpner den med `:` forhåndsutfylt. Sletter man kolonet, er man
  i søk – én inndatalinje, ingen moduser å huske.
- `SearchContext` utvides fra `open(query?)` til `{ openSearch(query?), openCommands(query?) }`;
  `useOpenSearch()` beholdes som snarvei for tagg-klikk (`#tag`).
- Fuzzy-matching er en liten egen funksjon (delsekvens med bonus for ordstart og eksakt alias), ingen ny
  avhengighet (ADR-006). `:fold alle` treffer aliaset eksakt; `:fold` treffer «Fold/utfold seksjonen» først.
- **Kjøring:** Enter lukker paletten *først* (dialogen gir fokus tilbake), deretter kjøres kommandoen i
  neste animasjonsramme. Da kan `:hjelp` og `:utseende` åpne sin egen dialog uten stablede modaler, og
  `:zen`/`:fold alle` virker på siden med riktig fokus.
- Listeelementer i kommandomodus har `role=option`, `aria-disabled` for deaktiverte, og bindingen som
  `<kbd>`; samme combobox-mønster som søket (↑↓, ↵).

### 5. `?`-oversikten og README fra registeret (F6)

- `shortcutGroups(platform)` (`commands/model/shortcut-docs.ts`) gir gruppene i fast rekkefølge
  (Navigasjon, Lesing, Visning, Søk og kommandoer) med alle normal-modus-bindinger **og** tastehint
  (`KEY_HINTS`: ↑↓ ↵ ⌘↵ i paletten, ←→ Home End i base-faner, Tab → «Hopp til innhold»). Tastehintene er
  komponentenes egne ARIA-taster; de står i katalogen slik at oversikten er komplett (P2), men motoren
  binder dem ikke.
- `?`-panelet rendrer `shortcutGroups(isApple ? 'apple' : 'other')` i en `Modal`. AK-1.1-07 («identisk
  med registeret») følger av at det ikke finnes noen annen kilde.
- **README:** `npm run docs:shortcuts` (`tsx scripts/docs-shortcuts.ts`) erstatter teksten mellom
  `<!-- hurtigtaster:start -->` og `<!-- hurtigtaster:end -->` med
  `renderShortcutsMarkdown(shortcutGroups('docs'))` (viser `⌘K / Ctrl K`). Sync-testen
  `scripts/docs-shortcuts.test.ts` (server-prosjektet i Vitest, Node) feiler med «kjør npm run
  docs:shortcuts» hvis README avviker.
- Skriptet importerer kun `src/web/features/commands/model` og `src/web/features/keyboard`, som derfor
  **må forbli ren TS** (ingen `.tsx`, ingen `import.meta.env`, ingen DOM-tilgang ved import, ingen import av
  andre features). Frontend legger de to mappene til `include` i `tsconfig.tooling.json` sammen med
  skriptet. Skriptet og sync-testen lages i slice 1.1-a, når tastene faktisk virker – ikke før, ellers
  lover README taster som ikke finnes.

### 6. Migrering av ⌘K og ⌘.

| I dag | v1.1 |
|---|---|
| `SearchProvider` lytter på ⌘K og veksler paletten | Lytteren fjernes. `palette.search` (`Mod+k`, `/`) kaller `ports.palette.openSearch()`. Når paletten er åpen er motoren inaktiv (modal), og **paletten selv** lukker på ⌘K (dialogens egen tast) – samme veksle-oppførsel som før. |
| `ThemeProvider` lytter på ⌘. | Lytteren fjernes. `theme.toggleMode` (`Leader m`, `Mod+.` med `inTextFields`) kaller `ThemeContext.toggleMode`. |
| Esc i skuff og vault-meny | Beholdes lokalt (de er «lukk denne»), men kaller `preventDefault()` når de konsumerer Esc, så `system.escape` (avslutt zen) ikke også kjører. |
| Esc i `<dialog>` | Uendret (native). Motoren er inaktiv bak modal. |

`CommandProvider` monteres i `VaultLayout` innenfor `SearchProvider` (trenger palett, router og vault).
Eksisterende tester som sender ⌘K/⌘. til `document` må rendre med `CommandProvider` (testhjelperen
`render-with-providers` utvides); det er forventet testendring, ikke regresjon.

### 7. Plassering

```
src/web/features/keyboard/          ren TS, ingen React
  modes.ts                          KEY_MODES, KeyMode (P3)
  key-notation.ts                   parse/format, chordId, LEADER_KEY
  key-input.ts                      KeyboardEvent → kandidat-akkorder (norsk layout)
  key-policy.ts                     P4/P5/P7-regler, validateBindings
  key-engine.ts                     motorens typer (implementeres i 1.1-a: createKeyEngine)
  dom-guard.ts                      isTextEntryTarget, isSpaceActivationTarget, hasOpenModal
src/web/features/commands/
  model/                            ren TS (leses også av docs-skriptet)
    catalog.ts                      COMMAND_CATALOG, CommandId, KEY_HINTS
    command-types.ts, command-context.ts, registry.ts, shortcut-docs.ts, palette-types.ts
  CommandProvider.tsx               (1.1-a) handlere, porter, window-lytter, which-key
  ShortcutHelp.tsx, WhichKey.tsx    (1.1-a)
```

Avhengighetsretning: `app` → `commands` → `keyboard`. `commands` (React-delen) leser kontekster fra
`search`, `theme`, `view-settings` og `outline` via deres `index.ts`; `model/` importerer ingen av dem.

## Konsekvenser

- Én kilde for taster: palett, oversikt, which-key, README og policytest kan ikke divergere.
- Ny kommando = én oppføring i katalogen + én handler (typesjekket). Ny modus = utvid `KEY_MODES`.
- Space som leader fjerner «Space ruller» – tastaturbrukere som er vant til det, må bruke `Ctrl d`/`j`
  eller PageDown (som fortsatt virker native). Space på knapper/faner er uendret.
- Risiko: nettleseren reserverer noen Ctrl-kombinasjoner på Windows/Linux (Ctrl+U = vis kilde i noen
  nettlesere). `preventDefault()` virker i Chrome/Firefox for Ctrl+D og Ctrl+U i dag; QA verifiserer i e2e.
