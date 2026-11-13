# Vault-leser

En lokal, **skrivebeskyttet** nettleser for Obsidian-vaults. Den viser notater, lenker, embeds, callouts,
kodeblokker, Mermaid-diagrammer og Bases slik du kjenner dem fra Obsidian – med søk, live reload og
lys/mørk modus. Den endrer aldri filene dine og lytter bare på `127.0.0.1`.

## Kom i gang

**Krav:** Node.js **22.22 eller nyere** – både Node 22 LTS og Node 24 LTS (med npm 10 eller 11) er testet.
[`.nvmrc`](.nvmrc) peker på Node 24 LTS.

```sh
nvm install && nvm use   # valgfritt: henter versjonen i .nvmrc
npm ci
npm start
```

Bruk `npm ci`, ikke `npm install`: `npm ci` installerer nøyaktig versjonene i `package-lock.json`, som alle er
minst 21 dager gamle ([ADR-006](docs/arkitektur/ADR-006-avhengighetspolicy.md)).

Åpne <http://127.0.0.1:4317>. Uten videre oppsett viser leseren testvaultet i `test-vault/`.

`npm start` bygger nettsiden (bare når kilden er endret siden forrige gang) og starter serveren.
Avslutt med `Ctrl C`.

## Pek på ditt eget vault

Raskest – ett vault, rett fra kommandolinja:

```sh
npm start -- --vault ~/Documents/MittVault
```

Varig oppsett: lag **`vault-reader.config.local.json`** i prosjektmappa. Den er git-ignorert og
**erstatter** den innsjekkede `vault-reader.config.json` helt.

```json
{
  "port": 4317,
  "defaultVault": "jobb",
  "vaults": [
    { "id": "jobb", "name": "Jobb", "path": "~/Documents/Jobb" },
    { "id": "privat", "name": "Privat", "path": "~/Documents/Privat", "ignore": ["Arkiv"], "hiddenProperties": ["intern"] }
  ]
}
```

| Felt | Betydning |
|---|---|
| `vaults[].id` | Små bokstaver, tall og bindestrek. Brukes i URL-en (`/v/jobb/...`). |
| `vaults[].name` | Visningsnavn (valgfritt, standard = `id`). |
| `vaults[].path` | Sti til vault-mappa. `~` og relative stier (fra konfigfila) virker. |
| `vaults[].ignore` | Mapper (relativt til vaultet) som ikke skal indekseres. Valgfritt. |
| `vaults[].hiddenProperties` | Egenskaper som skjules i notat-headeren. Valgfritt. |
| `vaults[].obsidianVault` | Vaultets navn i Obsidian, for lenker fra terminalpresentasjonen (`obsidian://`). Valgfritt; standard er mappenavnet. |
| `defaultVault` | Vaultet som åpnes på `/`. Standard = første i lista. |
| `port` | Standard `4317`. |

### Flere vaults

Legg alle i `vaults`-lista. Bytt mellom dem med vaultvelgeren øverst i sidepanelet. Hvert vault har
egne, bokmerkbare adresser (`/v/<id>/<notat>`), og et vault indekseres først når du åpner det.

### Kommandolinje og miljøvariabler

Rekkefølge: **kommandolinje > miljøvariabel > konfigfil > standard.** Flagg sendes etter `--`:

| Flagg | Miljøvariabel | Hva |
|---|---|---|
| `--vault <sti>` | `VAULT_READER_VAULT` | Legg til dette vaultet (id `cli`) og åpne det. |
| `--config <fil>` | `VAULT_READER_CONFIG` | Bruk en annen konfigfil. |
| `--vault-id <id>` | `VAULT_READER_VAULT_ID` | Velg hvilket vault som åpnes på `/`. |
| `--port <n>` | `VAULT_READER_PORT` | Annen port. |
| `--lan` | `VAULT_READER_LAN=1` | Gjør leseren tilgjengelig på hjemmenettet (se «Lese på mobilen»). |

```sh
npm start -- --config ~/vaults.json --vault-id privat
VAULT_READER_PORT=4400 npm start
```

## Bruk

### Tastatursnarveier

Leseren styres med tastene under (vim-inspirert, normal-modus). På macOS vises `⌘`, ellers `Ctrl`; begge virker
overalt. `Space` er leder: trykk og vent litt, så viser et hint fortsettelsene. Tastene virker ikke mens du skriver
i et felt eller har en dialog åpen. `?` viser den samme oversikten i appen, og `:` åpner paletten i kommandomodus,
der alle kommandoene kan kjøres (også de uten taster, som `:tema terminal`, `:palett fosfor`, `:lys` og `:mørk`).

Tabellen genereres fra kommandoregisteret med `npm run docs:shortcuts`. Ikke rediger den for hånd.

<!-- hurtigtaster:start -->
| Gruppe | Taster | Kommando |
|---|---|---|
| Navigasjon | `j`, `k` | Rull ned / opp |
|  | `Ctrl d`, `Ctrl u` | Halv side ned / opp |
|  | `gg`, `G` | Til toppen / bunnen |
|  | `H`, `L` | Tilbake / frem i historikken |
| Lesing | `za` | Fold/utfold seksjonen |
|  | `zM`, `zR` | Fold alle / utfold alle |
| Visning | `Space w` | Bytt lesebredde |
|  | `Space d` | Diskré embedding – dette notatet |
|  | `Space z` | Zen-modus |
|  | `Space m`, `⌘.` / `Ctrl .` | Bytt lys/mørk |
|  | `Space t` | Åpne Utseende |
| Søk og kommandoer | `⌘K` / `Ctrl K`, `/` | Søk i notater |
|  | `:` | Kommandoer |
|  | `?` | Hurtigtastoversikt |
|  | `Esc` | Lukk / avbryt |
| Presentasjon | `Space p` | Presenter |

Taster i paletten, base-fanene og hopp-lenken (håndteres av komponentene selv):

- `←`, `→`, `Home`, `End`: Bytt fane (view) i en base når fanene har fokus.
- `Tab`: Første trykk gir «Hopp til innhold».
- `↑`, `↓`: Velg treff eller kommando i paletten.
- `↵`: Åpne treffet / kjør kommandoen.
- `⌘↵` / `Ctrl ↵`: Åpne treffet i ny fane.
- `←`, `→`, `↑`, `↓`, `h`, `j`, `k`, `l`: Flytt markøren i lysbildeoversikten.
- `↵`: Gå til lysbildet i oversikten.
<!-- hurtigtaster:end -->

#### I presentasjon

`Space p` eller `:presenter` viser notatet som lysbilder, fra seksjonen ved leseposisjonen (se
[Presentasjon](#presentasjon)). Da gjelder egne taster (present-modus): `Space` er *neste lysbilde*, ikke leder, og
`Esc` avslutter. Tabellen genereres fra samme register.

<!-- hurtigtaster-presentasjon:start -->
| Gruppe | Taster | Kommando |
|---|---|---|
| Presentasjon | `j`, `→`, `n`, `Space`, `PageDown`, `k`, `←`, `p`, `PageUp` | Neste / forrige lysbilde |
|  | `gg`, `G` | Første / siste lysbilde |
|  | `↓`, `↑` | Rull stor blokk ned / opp |
|  | `o` | Lysbildeoversikt |
|  | `b`, `.` | Svart skjerm |
|  | `f` | Fullskjerm |
| Visning | `⌘.` / `Ctrl .` | Bytt lys/mørk |
| Søk og kommandoer | `:` | Kommandoer |
|  | `?` | Hurtigtastoversikt |
|  | `Esc` | Lukk / avbryt |

Taster i lysbildeoversikten (`o`) og paletten (håndteres av komponentene selv):

- `←`, `→`, `↑`, `↓`, `h`, `j`, `k`, `l`: Flytt markøren i lysbildeoversikten.
- `↵`: Gå til lysbildet i oversikten.
- `↑`, `↓`: Velg treff eller kommando i paletten.
- `↵`: Åpne treffet / kjør kommandoen.
<!-- hurtigtaster-presentasjon:end -->

### Presentasjon

Et notat kan vises som lysbilder direkte i leseren (v2), for statusmøter i Teams/Zoom eller på projektor. Ingenting
skrives til notatet, og ingenting leses fra frontmatter: lysbildene utledes av overskriftene.

- **Struktur:** notattittelen blir tittellysbildet. Øverste overskriftsnivå i brødteksten (vanligvis H2) blir
  agendapunkter, nivået under (H3) blir lysbilder. Før hvert agendapunkt kommer en overgang med agendaen og «du er
  her». Innebygde notater (`![[…]]`) presenteres alltid som diskré embedding, og foldetilstand ignoreres.
- **`---`** (også `***` og `___`) deler et lysbilde; delene etter den første får «(forts.)».
- **For mye innhold** krympes til et lesbart minimum og fortsetter så på et «(forts.)»-lysbilde. Kode, tabeller,
  diagrammer og baser deles aldri; en blokk som er for stor alene ruller internt (`↑`/`↓`).
- **Lysbildenivå:** `:presenter h4` gir lysbilder på H4 (agendaen blir nærmeste nivå over). Valget huskes for
  notatet i denne nettleseren; `:presenter auto` fjerner det.
- **`:agenda av`** fjerner overgangene for gjeldende presentasjon (huskes ikke).
- **URL:** gjeldende lysbilde står i adressen (`?lysbilde=plan-q1`), så en lenke eller ny lasting åpner samme
  lysbilde. Tilbake i nettleseren avslutter presentasjonen.
- **Fullskjerm** startes når presentasjonen starter, hvis nettleseren tillater det. `f` slår den av og på.
  Nettleseren bruker første `Esc` til å gå ut av fullskjerm; neste `Esc` avslutter presentasjonen.
- **Live:** endringer i vaultet (også Bases-data) vises med en gang, og du blir stående på samme lysbilde.

### Presentasjon i terminalen

Samme lysbilder kan vises direkte i terminalen (v3, laget for Ghostty), uten at web-leseren kjører:

```sh
npm run present -- "Statusmøte uke 45"      # navn, alias eller sti; fuzzy-treff
npm run present -- Statusmøte uke 45        # uten anførselstegn virker også
npm run present                             # søkbar notatliste
npm run present -- --hjelp                  # alle flagg
```

- Flaggene `--vault`, `--config` og `--vault-id` virker som for `npm start`. I tillegg `--niva h<n>`, `--palett <navn>`,
  `--farger terminal` og `--uten-agenda`.
- Er navnet tvetydig (f.eks. «rapport»), åpnes notatlisten med søket utfylt. Skriv for å filtrere, `↑`/`↓` flytter,
  `Enter` presenterer og `Esc` avslutter.
- `j`/`k` (og piltaster, `Space`, `PageDown`/`PageUp`) blar, `gg`/`G` går til første og siste, `b` gir svart skjerm.
  `q`, `Esc` og `Ctrl c` avslutter, og terminalen blir alltid som før (også ved krasj eller når vinduet lukkes).
- Lenker kan Cmd-klikkes i Ghostty: interne lenker åpner notatet i Obsidian (`obsidian://`), eksterne åpner nettleseren.
- Terminalen må være minst 80 × 24. Del et vindu på 100–130 kolonner i Teams/Zoom; `Ctrl +` i Ghostty gir større tekst.
- Første start bygger presentasjonen (`dist/terminal/`, under ett sekund); senere starter går rett på.

### Temaer

Åpne **Utseende** nederst i sidepanelet (ikonet øverst til høyre på mobil):

- **Modus:** System, Lys eller Mørk.
- **Typografi:**
  - *Tidsskrift* – seriff (Spectral), marginalnoter, figurnummer og initial.
  - *Terminal* – grotesk (Schibsted Grotesk) og mono med ligaturer, tett og teknisk.
  - *Klartekst* – Atkinson Hyperlegible: tydelige tegnformer (I l 1, 0 O), stor x-høyde og romslig linjeavstand. Godt valg ved
    lesevansker eller nedsatt syn.
- **Palett:** Papir, Cyanotypi, Fosfor eller Signal. Alle typesett virker med alle paletter, i lys og mørk
  (3 × 4 × 2 kombinasjoner, alle kontrollert mot WCAG AA).
- **Ornamentikk:** initial og seksjonsnummer (§) av/på (påvirker bare Tidsskrift og Terminal).

Valget lagres i nettleseren. Du kan også lenke til et tema: `?type=klartekst&palette=signal&mode=dark`
(`type` = `tidsskrift` | `terminal` | `klartekst`, `palette` = `papir` | `cyanotypi` | `fosfor` | `signal`,
`mode` = `light` | `dark` | `system`).

## Lese på mobilen

Som standard svarer leseren bare på maskinen den kjører på (`127.0.0.1`). For å lese på mobilen over
hjemmenettet starter du den i **LAN-modus**:

```sh
npm start -- --lan
```

Eller sett `"lan": true` i konfigfila, eller `VAULT_READER_LAN=1`. Leseren skriver da ut en advarsel og
adressene du kan åpne på mobilen (samme Wi-Fi), for eksempel:

```
Åpne på mobilen (samme Wi-Fi):
  http://192.168.1.23:4317
  http://kundes-macbook.local:4317
```

- **Bare på nettverk du stoler på.** I LAN-modus kan alle på samme nettverk lese vaultet, uten passord.
  Ikke bruk det på kafé, hotell eller gjestenett. Leseren er fortsatt skrivebeskyttet.
- Adressen må være en av dem leseren skrev ut (maskinens egne IP-adresser eller `<maskinnavn>.local`).
  Andre vertsnavn avvises, som vern mot såkalt DNS-rebinding.
- macOS kan spørre om Node får ta imot innkommende tilkoblinger – svar **Tillat**.
- Får maskinen ny IP-adresse, virker den nye adressen etter noen sekunder uten omstart.
- Slå av ved å starte på nytt uten `--lan`.

## Feilsøking

**`Vault-leseren krever Node.js 22.22 eller nyere`** – oppgrader Node (`nvm install && nvm use`, eller
last ned fra [nodejs.org](https://nodejs.org)), og kjør `npm ci` på nytt.

**`npm error code E403` … `Requested item is quarantined`** – firmaets npm-proxy/brannmur (f.eks. Sonatype
Nexus) holder tilbake en pakkeversjon, som regel fordi den er nylig publisert. Sjekk at du bruker `npm ci`
(ikke `npm install`, som kan hente nyere versjoner enn lockfila). Alle versjoner i lockfila skal være minst
21 dager gamle; `npm run check:deps` viser om noen er yngre (`-- --days 30` for en strengere grense). Står
pakken fortsatt i karantene, send pakkenavn og versjon fra feilmeldingen til den som drifter npm-proxyen,
eller til oss.

**`Porten 4317 på 127.0.0.1 er allerede i bruk`** – en annen prosess, ofte en leser som allerede kjører,
bruker porten. Leseren avslutter da med denne meldingen. Stopp den andre prosessen, eller velg en annen port:
`npm start -- --port 4400` (eller `"port"` i konfigfila / `VAULT_READER_PORT`).

**`Konfigurasjonsfeil: …`** – meldingen sier hvilket felt som er feil. Vanligst er ugyldig JSON eller en
`id` med store bokstaver/mellomrom.

**`Advarsel: vaultet «x» peker på …, som ikke finnes`** – sjekk `path`. Relative stier regnes fra mappa
konfigfila ligger i.

**Et notat ser feil ut** – leseren dekker vanlig Obsidian-markdown. Dataview, LaTeX-blokker, Canvas og
Excalidraw vises som et «ikke støttet»-kort med kildeteksten.

## Utvikling

```sh
npm run dev         # server med omstart (:4317) + Vite med hot reload (http://127.0.0.1:5173)
npm test            # enhetstester (Vitest)
npm run test:e2e    # Playwright mot ekte server og en kopi av test-vault
E2E_PORT=4418 npm run test:e2e   # samme, på en annen port hvis 4318 er opptatt
npm run lint        # ESLint
npm run build       # typesjekk + produksjonsbygg
npm run check:deps  # alle versjoner i lockfila er minst 21 dager gamle (ADR-006)
npm run docs:shortcuts  # skriver hurtigtast-tabellen i README fra kommandoregisteret
```

Avhengigheter oppdateres med `npm install --before=<dato for 21 dager siden>`, se
[ADR-006](docs/arkitektur/ADR-006-avhengighetspolicy.md).

Ytelsestest (AK17) mot et generert vault med 2000 notater:

```sh
node test-vault-tools/generate-large-vault.mjs --out /tmp/vault-2000 --count 2000
PERF_VAULT=/tmp/vault-2000 npx playwright test --project=perf
```

Kode: `src/server` (Hono, indeks, rendering), `src/web` (React), `src/core` (ren TS uten plattform: lysbildemodell, disposisjon, tastatur og kommandoer – delt av web og terminal), `src/terminal` (presentasjon i terminalen) og `src/shared` (API-typer).
Arkitektur og beslutninger: [`docs/arkitektur/`](docs/arkitektur/) og
[`docs/beslutninger.md`](docs/beslutninger.md). Testvaultets fasit: [`test-vault/README-QA.md`](test-vault/README-QA.md).
