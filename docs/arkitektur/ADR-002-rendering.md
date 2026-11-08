# ADR-002: Markdown-rendering på serveren, HAST til klienten

- Status: Vedtatt (arkitekt), 2026-11-05

## Kontekst

Obsidian-syntaks (wikilinks, embeds, callouts, block-refs, `==markering==`, `%%kommentarer%%`, Bases-blokker)
krever kunnskap om **hele vaultet** for å rendres riktig: lenkemål, brutte lenker, innebygde notater med
syklusvern, Bases-spørringer. Indeksen lever på serveren. Samtidig skal klienten ha interaktive deler
(kopier-knapp, foldbare callouts, Mermaid, Bases-faner, intern navigasjon uten full sidelasting).

Alternativer:

1. **Klient-side rendering** av rå markdown: klienten må laste parser, Shiki-grammatikker og etterspørre
   lenkeoppløsning/embeds/Bases separat. Tregt, komplisert, dobbel logikk.
2. **Server → HTML-streng** + `dangerouslySetInnerHTML`: enkelt, men interaktive deler må «hydreres»
   manuelt med DOM-manipulasjon utenfor React.
3. **Server → sanitert HAST (JSON)** + klient gjør HAST → React-elementer med komponent-mapping. ✅

## Beslutning

Alternativ 3. Serveren kjører hele pipelinen og returnerer `NoteDocument.content: HastRoot` (se api.md).
Klienten rendrer med `hast-util-to-jsx-runtime` og en `components`-mapping. Egne elementer har prefiks
`vr-` og bærer data i `data-*`-attributter (kontrakten står i api.md, «HAST-kontrakt»).

### Pipeline (rekkefølgen er sikkerhetskritisk)

```
kildetekst
 │ 1. preprocess: fjern %%kommentarer%% (kode-bevisst skanner: ikke i ``` eller `inline`)
 ▼
remark-parse + remark-frontmatter + remark-gfm (tabeller, oppgaver, fotnoter, ~~gjennomstreking~~)
 │ 2. egne remark-plugins (mdast, kun i tekstnoder → aldri inne i kode):
 │    wikilinks/embeds, ==markering==, ^blokk-id, #tagger, ```base / ```mermaid-merking,
 │    LaTeX/Dataview → «ikke støttet»-markør
 ▼
remark-rehype (allowDangerousHtml) → rehype-raw
 │ 3. rehype-sanitize – GitHub-skjema UTVIDET med våre data-vr-*-attributter og klassenavn
 │    ── alt FØR dette punktet regnes som upålitelig input ──
 │    ── alt ETTER dette punktet er pålitelig, servergenerert struktur ──
 │ 4. pålitelige rehype-steg:
 │    overskrift-id-er (github-slugger) + TOC-uttrekk
 │    callouts (blockquote med [!type] → vr-callout)
 │    kodeblokker → vr-code med Shiki-HAST inni
 │    mermaid → vr-mermaid, base-blokker → vr-base (+ evaluering, ADR-003)
 │    embeds → vr-embed med målets ferdig rendrede (allerede sanerte) HAST inni
 ▼
HastRoot (JSON) → klient
```

Hvorfor sanitere midt i: rå HTML i markdown kan være delt over flere mdast-noder, så den må parses samlet
(`rehype-raw`) og saneres samlet. Våre egne strukturer legges på etterpå, slik at sanitizer-skjemaet kan
holdes stramt. Steg 2 produserer kun standard-elementer (`a`, `mark`, `span`, `div`) med `data-vr-*`-attributter
som er eksplisitt tillatt i skjemaet. At en bruker kan skrive `<a data-vr-link="internal">` i rå HTML er
ufarlig – det blir bare en intern lenke.

Ingen `style`-attributter, `<script>`, `on*`-handlere, `javascript:`-URL-er eller `<iframe>` slipper gjennom
sanitizeren. Shiki-output (inline `style` med CSS-variabler) legges til etter sanering og er derfor tillatt.

### Embeds og syklusvern

- `![[notat]]`, `![[notat#Overskrift]]`, `![[notat#^blokk]]`, `![[Fil.base]]`, `![[bilde.png|300]]`.
- Embed-resolveren får en **stakk** av `filePath#anker` som allerede er under rendering. Treff i stakken
  → `vr-embed` med `data-status="cycle"`. Maks dybde **4** → `data-status="depth-limit"`.
  Manglende mål → `data-status="missing"`.
- Resolveren injiseres i pipelinen som et grensesnitt (`EmbedResolver`), så markdown-featuren ikke
  avhenger av indeksen direkte (DIP) og kan testes med en falsk resolver.

### Syntax highlighting – tema uten re-render

Shiki kjøres på serveren med **ett CSS-variabel-tema** (`createCssVariablesTheme`), utvidet med ekstra
scopes for `number`, `type` og `property` slik UX har definert i `docs/design/tokens.css`.
Tokens får `style="color: var(--shiki-token-keyword)"` osv. Alle paletter × lys/mørk defineres kun i CSS,
så temabytte er et rent CSS-bytte: ingen ny forespørsel, ingen re-render, vilkårlig mange paletter.

- Highlighter opprettes **én gang** ved oppstart med et fast språksett (java, json, bash/sh/shell, yaml,
  sql, ts/tsx, js/jsx, html, css, xml, python, go, kotlin, dockerfile, diff, markdown, toml, ini, …).
- Ukjent språk → ren tekst (ingen feil), språkmerket vises likevel.
- Kodeblokk-meta: ` ```ts title="api.ts" ` og ` ```ts api.ts ` gir filnavn/tittel.

Vi valgte bort Shikis «dual themes» (`--shiki-light`/`--shiki-dark`): det låser oss til ett tema-par per
Shiki-tema og gir ett sett variabler per tema per token. CSS-variabel-temaet gir designerne full kontroll.
Ulempe: noe grovere tokeninndeling enn et fullt VS Code-tema – akseptabelt.

### Mermaid – klient-side

Mermaid trenger DOM/layout og er stort; det lastes dynamisk kun når `vr-mermaid` finnes. Kildekoden ligger
i `data-source`. Klienten initialiserer med `theme: 'base'`, `securityLevel: 'strict'` og `themeVariables`
lest fra gjeldende CSS-variabler, og rendrer på nytt når tema/palett/modus endres. Feil i diagrammet vises
som et feilkort med kildekoden, ikke som krasj. «Forstørr» åpner diagrammet i en dialog (AK15).

### Ytelse

- Rendering skjer **ved forespørsel**, ikke ved indeksering. Resultatet caches per dokument
  (LRU, ~200 innslag). Hele cachen tømmes ved hver indeksendring (enkelt og korrekt fordi embeds/Bases/
  backlinks kan avhenge av hvilken som helst fil; endringer er sjeldne).
- HAST-JSON er 3–5× større enn HTML. Over loopback er det uvesentlig; vi skrur på gzip i Hono hvis
  målinger viser behov.

## Konsekvenser

- + Klienten blir enkel og rask; all Obsidian-logikk er testbar på serveren med rene funksjoner.
- + Interaktive deler er vanlige React-komponenter – ingen DOM-hacking.
- + Sikkerhetsgrensen er ett tydelig punkt i pipelinen.
- − Rekkefølgen i pipelinen må beskyttes av tester (XSS-tester i `markdown`-featuren er obligatoriske).
- − `==markering==` som krysser formatering (`==**fet**==`) støttes ikke i v1 (plugin jobber per tekstnode).
- − Klientens komponent-mapping må holde tritt med HAST-kontrakten i api.md.
