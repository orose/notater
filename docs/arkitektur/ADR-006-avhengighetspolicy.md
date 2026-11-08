# ADR-006: Avhengighetspolicy – bare versjoner som er minst 21 dager gamle

- Status: Vedtatt (arkitekt), 2026-11-06. PO-beslutning: PO-52 i [`beslutninger.md`](../beslutninger.md).
- Relaterte: ADR-001 (stack)

## Kontekst

Kunden fikk `npm install` avvist av firmaets Sonatype Nexus-brannmur:

```
npm error code E403
npm error 403 Forbidden - GET …/undici/-/undici-8.12.4.tgz - Requested item is quarantined
```

`undici@8.12.4` var publisert dagen før. Mange pakker i lockfila var bare 1–14 dager gamle. Bedriftsbrannmurer
setter ofte nylig publiserte versjoner i karantene til de er analysert, og en fersk versjon er også den
vanligste veien inn for supply chain-angrep (kapret vedlikeholderkonto, ondsinnet patch-versjon som
oppdages og trekkes etter noen dager). Vi har ingen funksjoner som trenger de siste dagenes patcher.

## Beslutning

### 1. Alle låste versjoner skal være minst 21 dager gamle

Gjelder **alle** pakker i `package-lock.json`, også transitive og devDependencies (kunden kjører `npm ci`,
som henter alt). Grensen sjekkes med:

```sh
npm run check:deps               # standard 21 dager
npm run check:deps -- --days 30  # strengere, f.eks. hvis kundens brannmur krever det
```

`scripts/check-dependency-age.mjs` (ren Node, ingen avhengigheter) leser lockfila, henter publiseringstid
for hver `navn@versjon` fra registryet (`npm_config_registry`, `--registry` eller registry.npmjs.org) og
feiler (exit 1) hvis noen er yngre enn grensen. Exit 2 betyr at oppslag feilet. Skal kjøres før hver
endring i lockfila sjekkes inn, og før en leveranse til kunden.

Gulvet i `package.json`-områdene (`^x.y.z`) skal også være en versjon som er minst 21 dager gammel; ellers
finnes det ingen gyldig versjon før datoen, og `npm install --before` feiler med `ETARGET`.

### 2. Slik oppdaterer vi avhengigheter

Bygg lockfila på nytt med en dato 21 dager tilbake, slik at npm bare ser versjoner publisert før den:

```sh
DATO=$(node -p "new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10)")
rm -rf node_modules package-lock.json
npm install --before="$DATO"
npm run check:deps && npm test && npm run lint && npm run build && npm run test:e2e
```

- Lockfila slettes fordi `--before` ellers kan beholde låste versjoner som allerede er for nye.
- Med npm 11 (Node 24) kan `npm install --min-release-age=21` brukes i stedet for datoen. Vi legger den
  **ikke** i `.npmrc`, fordi npm 10 (Node 22) ikke kjenner innstillingen og advarer om den.
- Én pakke oppdateres med `npm install <pakke>@<versjon> --before="$DATO"`.
- En sikkerhetsfiks som er yngre enn 21 dager kan tas inn som unntak etter PO-beslutning. Unntaket noteres i
  `beslutninger.md`, og vi må regne med at kunden kan bli stoppet av brannmuren til versjonen er godkjent.

### 3. Overrides: `playwright-core` følger `@playwright/test`

```json
"overrides": { "playwright-core": "$@playwright/test" }
```

`@playwright/test` er låst eksakt (Chromium-revisjonen er forhåndsinstallert, og `playwright install` skal
aldri kjøres). `@axe-core/playwright` har `playwright-core` som peer-avhengighet (`>= 1.0.0`), og npm
installerer da nyeste `playwright-core` på toppnivå – en annen versjon enn den `@playwright/test` bruker. Det
ga typefeil i e2e og kunne krevd en annen nettleser-revisjon. Overriden tvinger én `playwright-core`, med
samme versjon som `@playwright/test`. Regel: oppgraderes `@playwright/test`, følger `playwright-core` med
automatisk; ingen andre overrides uten ny ADR/PO-beslutning.

### 4. Install-skript: esbuild nektes eksplisitt

npm 11.19+ kjører ikke install-skript fra avhengigheter som ikke er godkjent i `allowScripts`, og advarer om
dem. Eneste pakke med install-skript er `esbuild` (postinstall som bare optimaliserer oppstart; binærfila
kommer fra den plattformspesifikke `@esbuild/*`-pakken). Vi har satt `"allowScripts": { "esbuild": false }`,
så advarselen forsvinner og ingen tredjepartskode kjøres ved installasjon. Verifisert: `npm ci`, build og
tester virker uten skriptet med npm 11, og npm 10 ignorerer feltet.

### 5. Kunden installerer med `npm ci`

README anbefaler `npm ci`, ikke `npm install`. `npm ci` installerer nøyaktig det som står i lockfila (som vi
har sjekket med `check:deps`), endrer aldri lockfila og feiler hvis den ikke stemmer med `package.json`.
`npm install` kan løse opp nyere versjoner innenfor `^`-områdene – og det var slik kunden traff en dags
gammel versjon.

## Konsekvenser

- Vi ligger 3–4 uker bak siste versjon av alle pakker. Akseptabelt for et lokalt, read-only verktøy.
- Ved nedgraderingen 2026-11-06 ble `jsdom` senket fra 31 til 30 (31 var for ny), og mange pakker en eller
  flere patch-/minor-versjoner. Ingen funksjonelle endringer; enhetstester, lint, build, e2e og AK17-ytelse
  er verifisert på Node 22 og Node 24.
- Eldre versjoner kan ha kjente sårbarheter. Kjør `npm audit` sammen med `check:deps`, og ta inn rettelsen så
  snart den er 21 dager gammel (en sårbar versjon kan også bli stoppet av brannmuren). Ved nedgraderingen ga
  `--before=2026-10-15` `undici@8.12.1` (dev, via jsdom) med 8 advarsler, én høy; den er løftet til `8.12.2`
  (rettet, 21 dager gammel) med `npm update undici --before=<dato>`. Gjenstår: `minimatch` (moderat, dev, via
  eslint/typescript-eslint) – rettet først i 11.0.1 (2026-10-27), som eslint-kjeden (`^10`) ennå ikke tillater. Følges opp ved neste oppdatering.
- Hvis kundens brannmur bruker en lengre grense enn 21 dager, kjøres `check:deps -- --days <n>` og lockfila
  bygges på nytt med tilsvarende dato.
- `check:deps` trenger nettverkstilgang til registryet (bak proxy settes `HTTPS_PROXY`; skriptet slår da på
  Node sin innebygde proxy-støtte). Det henter fulle pakkedokumenter, så det tar ~10 s for ~550 pakker.
