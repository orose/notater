# ADR-001: Teknisk stack

- Status: Vedtatt (arkitekt), 2026-11-05
- Relaterte: ADR-002 (rendering), ADR-003 (Bases), ADR-004 (indeks, lenker, live reload), ADR-005 (konfig og sikkerhet)

## Kontekst

Briefen låser: ren Node + TypeScript (B2), React med funksjonelle komponenter og named exports (B3),
feature-basert struktur (B4), TDD (B5), lokal kjøring på macOS (B7), ingen nettverkskall ut (B10),
og ytelseskrav ~2000 notater < 3 s / notatbytte < 200 ms (AK17). Teamet er lite og skal jobbe parallelt
(backend/frontend/QA), så stacken må være kjedelig, godt dokumentert og ha få bevegelige deler.

## Beslutning

### Kjøretid og språk

| Valg | Versjon | Begrunnelse |
|---|---|---|
| Node | **≥ 22.22** (Node 22 LTS, siste patch) | Kravet fra PO. Flere dev-verktøy (jsdom 31, Vite 8) krever 22.12+/22.22+. Kunden bør bruke siste Node 22 eller 24. |
| TypeScript | **~6.0** | TS 7 (native) finnes, men typescript-eslint støtter foreløpig < 6.1. Oppgraderes når lint-verktøyet følger etter. |
| `tsx` | ^4 | Kjører serverens TypeScript direkte, både i dev (`tsx watch`) og ved `npm start`. Ingen egen server-kompilering. |

**Ingen egen byggesteg for serveren.** Serveren kjøres med `tsx` også i «produksjon». Dette er et lokalt verktøy;
oppstartskostnaden er neglisjerbar, og vi slipper `.js`-endelser i importer, `outDir`-oppsett og en ekstra
build-artefakt. Typesjekk skjer separat med `tsc -b` (del av `npm run build` og CI). Importer skrives
**uten filendelse** (`moduleResolution: bundler`).

### Server

| Bibliotek | Rolle |
|---|---|
| **Hono** + `@hono/node-server` | HTTP-ruting, JSON, SSE (`hono/streaming`), statiske filer. Lett, godt typet, testbar uten nettverk (`app.request()`). Hver feature eksporterer sin egen `Hono`-underapp. |
| **unified / remark / rehype** | Markdown → mdast → hast. Se ADR-002. Pakker: `remark-parse`, `remark-gfm`, `remark-frontmatter`, `remark-rehype`, `rehype-raw`, `rehype-sanitize`, `mdast-util-find-and-replace`, `unist-util-visit`, `github-slugger`. |
| **Shiki** (v4) | Syntax highlighting på serveren med CSS-variabel-tema. Se ADR-002. |
| **yaml** | Frontmatter og `.base`-filer. Parses med YAML 1.2 `core`-skjema (datoer forblir strenger; vi tolker dem selv). |
| **chokidar** (v4) | Filovervåking. Se ADR-004. |
| **MiniSearch** | Fulltekstsøk i minnet for ⌘K (tittel, aliaser, innhold). |
| Egen kode | Bases-parser/evaluator (ADR-003), lenkeoppløsning (ADR-004), konfig (ADR-005). |

Vi valgte bort: Express (eldre API, svakere typer), Fastify (mer enn vi trenger), en database (B2),
og ferdige «remark-obsidian»-pakker (ujevn kvalitet, dekker ikke vår kombinasjon; våre plugins er små).

### Web

| Bibliotek | Rolle |
|---|---|
| **React 19** + **Vite 8** (`@vitejs/plugin-react`) | Krav fra PO. |
| **React Router 7** (deklarativ modus: `BrowserRouter`/`Routes`) | Bokmerkbare URL-er, frem/tilbake (AK11). Vi bruker bevisst v7 (velkjent API, Node ≥ 20) og ikke v8. |
| **TanStack Query 5** | Henting og cache av API-data. SSE-hendelser gjør `invalidateQueries` → live reload uten egen cache-logikk (AK12). |
| **hast-util-to-jsx-runtime** | Gjør serverens ferdige HAST om til React-elementer, med komponent-mapping for egne elementer (`vr-callout`, `vr-code`, …). Ingen `dangerouslySetInnerHTML`. |
| **Mermaid** (v12) | Klient-side, lazy-lastet (`import('mermaid')`) kun når et notat har diagrammer. Tema fra CSS-variabler. |
| CSS Modules + CSS custom properties | Komponentstil i `*.module.css`; alle farger/typografi fra designtokens (`docs/design/tokens.css`) på `<html data-type data-palette data-mode>`. Ingen CSS-rammeverk – designet skal være distinkt (AK6). |
| `@fontsource-variable/*` (velges av UX) | Fonter bundles lokalt (B10). |

### Test og kvalitet

| Verktøy | Bruk |
|---|---|
| **Vitest 5** | Unit/integrasjon. To prosjekter: `server` (node-miljø) og `web` (jsdom + Testing Library). Tester ligger ved siden av koden (`*.test.ts(x)`). |
| **Playwright 1.63.0** (låst) | E2E mot produksjonsbygget og `test-vault/`, prosjekter «desktop» og «mobil». Versjonen er låst eksakt fordi Chromium er forhåndsinstallert i `PLAYWRIGHT_BROWSERS_PATH` for denne versjonen. **Kjør aldri `playwright install`.** |
| **ESLint** + typescript-eslint + react-hooks | Håndhever B3/B5 maskinelt: `export default` og `import * as` gir feil (unntak: verktøy-konfigfiler som krever default export). |
| `tsc -b` | Typesjekk av tre prosjekter: server, web, tooling. |

### Kommandoer

| Kommando | Hva |
|---|---|
| `npm start` | `vite build` + start server på `http://127.0.0.1:4317`. Én kommando for kunden (AK18). Argumenter videre: `npm start -- --vault ~/Notater --port 4400`. |
| `npm run dev` | Server (`tsx watch`, port 4317) + Vite dev-server (`127.0.0.1:5173`, proxy `/api` → 4317) parallelt via `concurrently`. |
| `npm run build` | Typesjekk + produksjonsbygg av web til `dist/web`. |
| `npm test` | Alle Vitest-tester (server + web). |
| `npm run test:e2e` | Playwright (starter selv serveren på port 4318 mot `./test-vault`). |
| `npm run lint` / `npm run typecheck` | Kvalitetsporter. |

## Konsekvenser

- + Én `package.json`, én `node_modules`, ingen workspaces – enklest mulig (se struktur.md).
- + Klient og server deler typer direkte via `src/shared/api-types.ts`.
- + Serveren gjør det tunge (parse, lenker, Bases, highlighting); klienten er en tynn, rask presentasjon.
- − `tsx` er en runtime-avhengighet. Akseptabelt for et lokalt verktøy; kan byttes mot Nodes innebygde
  type-stripping senere (krever `.ts`-endelser i importer).
- − `npm start` bygger web hver gang (~1–3 s). Akseptabelt; kan optimaliseres med «bygg kun hvis endret» senere.
- − Kunden må ha Node ≥ 22.22. Må stå tydelig i README.
