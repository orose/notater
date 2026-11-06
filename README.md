# Vault-leser

En lokal, **skrivebeskyttet** nettleser for Obsidian-vaults. Den viser notater, lenker, embeds, callouts,
kodeblokker, Mermaid-diagrammer og Bases slik du kjenner dem fra Obsidian – med søk, live reload og
lys/mørk modus. Den endrer aldri filene dine og lytter bare på `127.0.0.1`.

## Kom i gang

**Krav:** Node.js **22.22 eller nyere** (22 LTS eller 24 LTS). Versjonen vi tester med står i
[`.nvmrc`](.nvmrc).

```sh
nvm install && nvm use   # valgfritt: henter versjonen i .nvmrc
npm install
npm start
```

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

På macOS brukes `⌘`, ellers `Ctrl`. Begge virker overalt.

| Snarvei | Hva |
|---|---|
| `⌘K` / `Ctrl K` | Søk i notater, aliaser og tagger (`#tag` søker på tagg). |
| `↑` `↓`, `↵` | Velg og åpne treff i søket. |
| `⌘ ↵` / `Ctrl ↵` | Åpne treffet i ny fane. |
| `⌘ .` / `Ctrl .` | Bytt mellom lys og mørk modus. |
| `←` `→`, `Home` `End` | Bytt fane (view) i en base når fanene har fokus. |
| `Esc` | Lukk søk, dialoger, forstørret diagram og mobilmenyen. |
| `Tab` | Første trykk gir «Hopp til innhold». |

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
last ned fra [nodejs.org](https://nodejs.org)), og kjør `npm install` på nytt.

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
npm run lint        # ESLint
npm run build       # typesjekk + produksjonsbygg
```

Kode: `src/server` (Hono, indeks, rendering), `src/web` (React), `src/shared` (API-typer).
Arkitektur og beslutninger: [`docs/arkitektur/`](docs/arkitektur/) og
[`docs/beslutninger.md`](docs/beslutninger.md). Testvaultets fasit: [`test-vault/README-QA.md`](test-vault/README-QA.md).
