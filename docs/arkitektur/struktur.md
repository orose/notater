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
├── tsconfig.server.json         src/server + src/shared (Node-typer, ingen DOM)
├── tsconfig.web.json            src/web + src/shared (DOM, JSX)
├── tsconfig.tooling.json        *.config.ts + e2e/
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
    │   │   └── create-app.ts    komposisjonsrot: monterer feature-ruter, host-guard, statiske filer
    │   └── features/
    │       ├── config/          resolveConfig (fil/env/CLI), validering, AppConfig-typen
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
