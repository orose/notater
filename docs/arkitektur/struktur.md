# Mappestruktur

## Beslutning: én pakke, ingen workspaces

Én `package.json` og én `node_modules`. Server og web skilles av mapper og hver sin `tsconfig`, ikke av
pakker. Begrunnelse: vi har ett deployment (lokal maskin), ingen publisering av pakker, og delt kode er kun
typer (`src/shared`). npm workspaces ville gitt flere `package.json`-er, versjonskoordinering og
lenkingsproblemer uten gevinst. Hvis vi senere trenger en egen pakke (f.eks. Bases-evaluatoren som
bibliotek), er `src/server/features/bases` allerede isolert nok til å flyttes ut.

## Oversikt

```
.
├── package.json                 scripts: start, dev, build, test, test:e2e, lint, typecheck
├── vault-reader.config.json     standardkonfig (peker på ./test-vault)
├── tsconfig.json                kun referanser → tre prosjekter under
├── tsconfig.base.json           felles strenge kompilatorvalg
├── tsconfig.server.json         src/server + src/shared + src/core + src/terminal (Node-typer, ingen DOM)
├── tsconfig.web.json            src/web + src/shared (DOM, JSX)
├── tsconfig.tooling.json        *.config.ts + e2e/ + scripts/ (+ src/core/commands og src/core/keyboard)
├── vite.config.ts               root = src/web, bygger til dist/web, proxy /api i dev
├── vitest.config.ts             prosjekter «server» (node) og «web» (jsdom)
├── playwright.config.ts         e2e mot `npm start -- --vault ./test-vault --port 4318`
├── eslint.config.js             håndhever named exports og ingen star-imports
├── e2e/                         Playwright-spesifikasjoner (*.spec.ts), skrives av utviklerne
├── test-vault/                  syntetisk vault (eies av QA)
├── test-vault-tools/            QAs generatorskript (f.eks. stort ytelsesvault)
├── docs/
│   ├── produkt/                 PO
│   ├── arkitektur/              arkitekt (ADR-er, struktur, api)
│   ├── design/                  UX (bl.a. tokens.css)
│   ├── test/                    QA
│   └── beslutninger.md          logg over antakelser og beslutninger
└── src/
    ├── shared/
    │   └── api-types.ts         NORMATIV kontrakt server ↔ web (kun typer)
    ├── server/
    │   ├── main.ts              oppstart: konfig → registry → app → listen(127.0.0.1)
    │   ├── app/
    │   │   ├── create-app.ts    komposisjonsrot: kobler feature-portene mot vault-registeret
    │   │   └── security.ts      host-guard, kun-GET, CSP og andre sikkerhetsheadere
    │   ├── shared/api-error.ts  felles ApiError-svar og ?path=-validering (brukes av alle rute-features)
    │   ├── test-support/        delte testhjelpere (falsk RenderContext, HAST-spørringer) – kun for *.test.ts
    │   └── features/
    │       ├── config/          resolveConfig (fil/env/CLI), validering, AppConfig-typen
    │       ├── markdown-syntax/ Obsidian-markdown → mdast (preprocess, wikilinks, tagger, blokk-id-er,
    │       │                    LaTeX, frontmatter, seksjoner). Laveste lag; delt av indeks og rendering
    │       ├── properties/      frontmatter → VaultValue (dokument-API, senere Bases)
    │       ├── tree/            buildTree + GET /tree
    │       ├── tags/            taggoversikt + GET /tags (PO-24)
    │       ├── vault-registry/  vaultId → VaultIndex (lat opprettelse, livssyklus, watcher per vault)
    │       ├── vault-index/     skanning, VaultFile, extractNoteMeta, inkrementelle oppdateringer
    │       ├── links/           resolveLink, ankeroppslag, backlink-graf
    │       ├── markdown/        unified-pipeline, egne remark/rehype-plugins, sanitize-skjema
    │       ├── code-highlight/  Shiki-highlighter (singleton), CSS-variabel-tema, språkliste
    │       ├── embeds/          EmbedResolver med syklus- og dybdevern
    │       ├── bases/           expression/ (lexer, parser, evaluate, functions), definition/, query/
    │       ├── documents/       GET /document: setter sammen indeks + markdown + links + bases
    │       ├── search/          MiniSearch-indeks, GET /search
    │       ├── assets/          GET /assets (vedlegg, MIME-hviteliste, CSP)
    │       ├── image-size/      bildedimensjoner fra filheader (PO-71), width/height for <img>; blad-feature
    │       └── live-events/     chokidar → debounce → indeksoppdatering → SSE /api/events
    └── web/
        ├── index.html
        ├── main.tsx             createRoot + <App/>
        ├── test-setup.ts        jest-dom + cleanup for Vitest
        ├── app/                 App-skall: providers (Query, Router, Theme), ruter, layout
        ├── shared/
        │   └── api/             typet fetch-klient + query-nøkler (bruker src/shared/api-types)
        └── features/
            ├── navigation/      sidepanel med filtre, brødsmuler, tastaturnavigasjon
            ├── vault-picker/    bytte vault (navigerer til /v/:vaultId)
            ├── note-view/       dokumentside, HastContent (HAST → React), komponent-mapping
            ├── properties/      frontmatter-panel
            ├── callout/         <Callout> for vr-callout (foldbar)
            ├── code-block/      <CodeBlock> for vr-code (språkmerke, tittel, kopier)
            ├── mermaid/         <MermaidDiagram> (lazy import, tema-bevisst, forstørr)
            ├── embed/           <Embed> for vr-embed (inkl. syklus/mangler-kort)
            ├── toc/             innholdsfortegnelse + scroll-spy
            ├── backlinks/       tilbakelenker
            ├── bases/           <BaseView>: faner, tabell, kanban, advarsler
            ├── search/          ⌘K-dialog
            ├── theme/           type × palett × modus, persistens, data-attributter på <html>
            └── live-reload/     EventSource → invalidateQueries
```

## Regler

1. **Feature først.** Kode som hører til én funksjon ligger i den featurens mappe – rute, logikk, typer og
   tester sammen. Ingen `controllers/`, `services/`, `components/`, `hooks/` på toppnivå.
2. **Offentlig flate.** Hver feature eksporterer det andre trenger fra `index.ts` (named exports).
   Andre features importerer **kun** fra `features/<x>/index` (eller `features/<x>`), aldri fra
   interne filer. Server-features eksporterer typisk en `create<X>Routes(deps): Hono` + domenefunksjoner.
3. **Avhengighetsretning (server):**
   `config` ← `vault-index` ← `links` ← `markdown`/`embeds`/`bases`/`search` ← `documents` ← `app`.
   Ingen sykler. Der en «lavere» feature trenger noe fra en «høyere» (f.eks. markdown trenger embeds),
   brukes et grensesnitt som injiseres (`EmbedResolver`, `RecordSource`, `LinkResolver`).
4. **Avhengighetsretning (web):** `app` → `features/*` → `shared/api`. `note-view` setter sammen
   komponent-mappingen fra `callout`, `code-block`, `mermaid`, `embed`, `bases`. Disse importerer
   ikke `note-view` (embeds får barna sine ferdig rendret som `children`).
5. **`shared/` er ikke en søppelkasse.** `src/shared` = kun API-typer. `src/web/shared` = kun API-klient og
   eventuelt helt generiske UI-primitiver som brukes av ≥ 3 features.
6. **Tester ved siden av koden:** `foo.ts` + `foo.test.ts`. Testdata for unit-tester lages inline eller i
   `__fixtures__/` i featuren. Integrasjonstester kan lese `test-vault/` (read-only).
7. **Navngiving:** filer i `kebab-case.ts`, React-komponenter i `PascalCase.tsx` med én eksportert komponent
   med samme navn. CSS Modules: `PascalCase.module.css` ved siden av komponenten.
8. **Importer** uten filendelse, relative stier. Ingen `export default`, ingen `import * as` (ESLint feiler).
   Unntak: tredjepartsbiblioteker som kun har default export (f.eks. `import mermaid from 'mermaid'`) er OK
   å *importere*; regelen gjelder våre egne eksporter.

## Tillegg fra backend (slice 0–2)

- **Avhengighetsretning (server), faktisk:**
  `config`, `markdown-syntax` ← `vault-index` ← `links` ← `markdown` ← `embeds` ← `search`/`properties` ←
  `vault-registry` ← `documents`/`tree`/`tags`/`assets`/`live-events` (ruter) ← `app`.
  `code-highlight`, `assets` (MIME-hviteliste), `image-size` (brukes av `vault-index`, `embeds`, `documents`) og
  `bases` (port) er blad-features.
- **Rute-features definerer egne, smale porter** (`TreeSource`, `SearchSource`, `AssetSource`, `EventSource` …)
  i stedet for å importere vault-registeret. `app/create-app.ts` kobler portene. Det hindrer sykler
  (registeret bruker f.eks. `search` og `live-events`), og rutene kan testes med falske kilder.
- **Metadata-uttrekk i worker-tråder** (`vault-index/meta-worker.ts`), jf. ADR-004. Workerne laster
  TypeScript via tsx-loaderen (absolutt sti), så de virker både under `tsx`, `npm start` og Vitest.

## Tillegg v1.1 (arkitekt, ADR-007–009)

Nye web-features:

```
src/web/features/
├── keyboard/        ren TS: modi, tastenotasjon, KeyboardEvent → akkord (norsk layout), policy (P4/P5/P7),
│                    motorens typer, DOM-vakter. Ingen React.
├── commands/
│   ├── model/       ren TS: katalogen (id, navn, aliaser, gruppe, bindinger), registeret, ?-/README-generering,
│   │                palett-typer. Leses også av `npm run docs:shortcuts` (Node) – ingen .tsx/DOM/andre features.
│   └── *.tsx        (1.1-a) CommandProvider (handlere, porter, window-lytter), which-key, ?-oversikt
├── view-settings/   (1.1-b/d) lesebredde, diskré per notat, zen – samme mønster som theme
└── outline/         (1.1-c/d) disposisjon fra HAST: diskré omskriving, TOC, §-nummer, seksjoner, folding
```

Avhengighetsretning: `app` → `commands` → `keyboard`; `commands` (React-delen) → `search`, `theme`,
`view-settings`, `outline`; `note-view` → `outline`, `view-settings`. `keyboard`, `commands/model` og
`outline` importerer ikke `note-view`.

## Tillegg v2 (arkitekt, ADR-010)

Ny web-feature:

```
src/web/features/presentation/
├── model/           ren TS: lysbildetyper, buildSlideDrafts (S1–S8), finalizeDeck (A2, nummer, progresjon),
│                    lysbilde-id-er, resolveSlide (posisjon ved live reload). Ingen React/DOM.
├── fit/             automatisk tilpasning (A2): logisk lerret, skalatrinn, målelerret, cache
├── presentation-storage.ts, presentation-url.ts, fullscreen.ts, presentation-control.ts
└── *.tsx            (2-a–2-c) PresentationProvider, PresentationLayer, Stage, SlideView, lysbildetyper, oversikt
```

Avhengighetsretning: `app` → `presentation` → `note-view` (`HastContent`), `outline`, `properties`, `shared/api`;
`commands` → `presentation` (kun kontrollporten og typer). `presentation` importerer ikke `commands`, og
`note-view`/`outline` importerer ikke `presentation`.

## Tillegg v3 (arkitekt, ADR-011)

```
src/core/            ren TS uten plattform (ingen DOM, Node eller React), delt av web og terminal (flyttet i K1–K6, PO-120):
├── hast/            splitLeadingTitle, prepareContent, inlineText, textContent
├── outline/         buildOutline, hiddenBlocks
├── presentation/    model/ (S1–S8, id-er, resolveSlide), fit/ (A2: fitDraft, packUnits, enkeregel PO-115),
│                    prepare-source.ts (NoteDocument → kilde, nivåinfo), fingeravtrykk (draftContentKey)
├── format/          ingress, datoer, formatBaseDate
├── keyboard/        notasjon, akkorder, policy, motor (dom-guard blir i web)
├── commands/        katalog med flater (web/terminal), register, fuzzy, palettvalg, `?`-grupper
└── test-support/    hast-bygger for tester (h, root)
src/terminal/        `npm run present` – frittstående presentasjon i terminalen (T7)
├── main.ts          inngang
├── app/             komposisjonsrot: konfig, VaultRuntime, økt (bruker server-features direkte, ingen HTTP)
└── features/        cli-args, screen, keys, cells (skjelett) · capabilities, vault, note-picker, session,
                     commands, slides, overlays (3-a) · theme, draw, figlet, command-line (3-b–3-c)
scripts/present.mjs  `npm run present` (M2): ren JS, bygger `dist/terminal/present.mjs` + `meta-worker.cjs` med esbuild
                     når kilden er endret, og kjører bunten i samme prosess (`exec`, ingen tsx-forelder, PO-119)
```

Avhengighetsretning: `web → core`, `terminal → core + server/features/*/index`, `core → shared`. `core` importerer aldri
`web`, `server`, `terminal`, `react` eller `node:*` (håndheves av at mappa ligger i både web- og server-tsconfig, og av
ESLint). `terminal` importerer aldri `web` eller `react` (ESLint). Regel 5 står fast: `src/shared` er kun API-typer.
