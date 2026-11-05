# API-kontrakt: server ↔ web

**Typene er normative i [`src/shared/api-types.ts`](../../src/shared/api-types.ts).** Dette dokumentet
beskriver endepunkter, semantikk og HAST-kontrakten, og gjengir de viktigste typene. Ved konflikt gjelder
TypeScript-fila; endringer gjøres i begge i samme leveranse.

## Generelt

- Base: `http://127.0.0.1:4317`. I dev går web via Vite (`127.0.0.1:5173`) som proxyer `/api`.
- Kun `GET`. Alle svar er JSON (`application/json; charset=utf-8`) unntatt `/assets` og `/events`.
- Feil: HTTP-status + `ApiError`:
  ```ts
  interface ApiError { error: { code: ApiErrorCode; message: string } }
  type ApiErrorCode = 'BAD_REQUEST' | 'VAULT_NOT_FOUND' | 'DOCUMENT_NOT_FOUND'
                    | 'ASSET_NOT_FOUND' | 'FORBIDDEN' | 'NOT_FOUND' | 'INTERNAL';
  ```
  400 `BAD_REQUEST` (også tom `path` / NUL-byte), 403 `FORBIDDEN` (feil Host-header), 404 `*_NOT_FOUND`,
  404 `NOT_FOUND` for ukjent API-rute (PO-24), 405 (kode `BAD_REQUEST`) for alt annet enn GET/HEAD (B1),
  500 `INTERNAL` (f.eks. vaultet kunne ikke indekseres).
- Alle svar har `Content-Security-Policy` (PO-16), `X-Content-Type-Options: nosniff` og
  `Referrer-Policy: no-referrer`. `Host` må være `127.0.0.1` eller `localhost` (porten sjekkes ikke, så
  Vite-proxyen virker).
- Stier i query-parametre er **URL-enkodet** (`encodeURIComponent`). Bruk query-parametre – ikke path-
  segmenter – for vault-stier, så skråstreker, `#`, `%` og mellomrom aldri tolkes av ruteren.
- Begreper:
  - `DocPath`: vault-relativ POSIX-sti; for `.md` **uten** endelse (`domene/Kunde`), ellers med
    (`Oppgaver.base`, `attachments/diagram.png`).
  - `FilePath`: alltid med endelse (`domene/Kunde.md`).
  - Oppslag av `DocPath`: (1) eksakt fil, (2) `DocPath + '.md'`. Ingen lenkeoppløsning her –
    `/document` tar kun eksakte stier (lenker er allerede oppløst i HAST).
- Forespørsler mot et vault som indekseres venter til indeksen er klar (ingen 503-polling i klienten).

## Nettleser-URL-er (klient-ruter)

| URL | Visning |
|---|---|
| `/` | Redirect til `/v/<defaultVaultId>` |
| `/v/:vaultId` | Vaultets forside: `Velkommen`/`index`/`README` på rot hvis den finnes, ellers en oversikt |
| `/v/:vaultId/<DocPath>` | Dokument, f.eks. `/v/jobb/domene/Kunde`, `/v/jobb/Oppgaver.base` |
| `…#<id>` | Overskrift (`#arkitektur-og-design`) eller blokk (`#^abc123`) |

`DocPath` i URL-en enkodes **per segment** (`/` beholdes). Frem/tilbake håndteres av React Router.
Søk er en dialog (⌘K), ikke en rute, i v1.

## Endepunkter

### `GET /api/health`
```ts
interface HealthResponse { status: 'ok'; version: string }
```

### `GET /api/vaults`
```ts
interface VaultsResponse { vaults: VaultSummary[]; defaultVaultId: VaultId }
interface VaultSummary {
  id: VaultId; name: string;
  status: 'not-indexed' | 'indexing' | 'ready' | 'error';
  noteCount: number | null; revision: Revision | null; errorMessage?: string;
  indexMs?: number;   // tillegg: ms fra indekseringsstart til klar (AK17)
}
```
`noteCount` = antall `.md`-filer (inkl. excalidraw).
Vault-stien på disk eksponeres **ikke**.

### `GET /api/vaults/:vaultId/tree`
Hele filtreet (kun indekserte filer). Mapper først, så filer; sortert med `nb`-kollasjon.
```ts
interface TreeResponse { vaultId: VaultId; revision: Revision; root: TreeFolder }
type TreeNode = TreeFolder | TreeFile;
interface TreeFolder { kind: 'folder'; name: string; path: string; children: TreeNode[] }
interface TreeFile   { kind: 'note' | 'base' | 'asset' | 'unsupported'; name: string; path: DocPath }
```
`unsupported` = `.canvas`, `.excalidraw.md`-filer o.l. – vises dempet; åpning gir «ikke støttet»-kort.

### `GET /api/vaults/:vaultId/document?path=<DocPath>`
```ts
type DocumentResponse = NoteDocument | BaseDocument;

interface NoteDocument {
  kind: 'note';
  vaultId: VaultId; revision: Revision;
  path: DocPath; filePath: FilePath; title: string;   // title = filnavn uten endelse
  mtime: IsoDateTime; ctime: IsoDateTime;
  aliases: string[]; tags: string[];                    // tags uten «#»
  properties: PropertyEntry[];                          // frontmatter i fil-rekkefølge, typet
  content: HastRoot;                                    // se HAST-kontrakt
  toc: TocEntry[];                                      // { depth, text, id }
  bases: Record<string, BaseResult>;                    // nøkkel = data-base-id i content
  backlinks: Backlink[];                                // { source, sourceTitle, snippet, count, fromProperty? }
  frontmatterError?: string | null;                     // tillegg PO-27: null = gyldig/ingen frontmatter
  warnings?: DocumentWarning[];                         // tillegg: { code: 'invalid-frontmatter', message }
  wordCount?: number;                                   // tillegg PO-23: ord i brødteksten (lesetid)
}

interface BaseDocument {
  kind: 'base';
  vaultId; revision; path; filePath; title; mtime; ctime; backlinks;
  result: BaseResult;
}
```
`unsupported`-filer (canvas o.l.) returneres som `NoteDocument` med `content` = ett `vr-unsupported`-element.
Bildevedlegg returneres som `NoteDocument` med `content` = ett `img` (via vedleggsruten); andre vedlegg som
`vr-unsupported` (`data-kind="other"`).

- `properties`: `cssclasses`, `publish` og `position` sendes aldri, heller ikke nøklene i vaultets
  `hiddenProperties` (konfig, PO-22/PO-29). `tags` og `aliases` sendes fortsatt (klienten viser dem i egne felt).
  Nestede objekter i frontmatter blir `{ type: 'string', value: <JSON> }`.
- `backlinks`: distinkte kilder, inkl. embeds, markdown-lenker og lenker i properties (`fromProperty: true`,
  PO-9). Selvlenker telles ikke. Sortert på kildens tittel.
- `bases`: inntil slice 3 er hvert resultat `{ views: [], warnings: [{ code: 'not-implemented', … }] }`.

### `GET /api/vaults/:vaultId/backlinks?path=<mål>` (tillegg, PO-28)
«Lenket fra» – også for mål som ikke finnes («ikke skrevet ennå»-siden). `path` kan være en `DocPath` eller
rå lenketekst (`data-vr-raw`, alias/anker fjernes). Brutte mål sammenlignes case-insensitivt, NFC, uten `.md`.
```ts
interface BacklinksResponse { vaultId; revision; path: string; exists: boolean; backlinks: Backlink[] }
```

### `GET /api/vaults/:vaultId/tags` (tillegg, PO-24)
```ts
interface TagsResponse { vaultId: VaultId; revision?: Revision; tags: { tag: string; count: number }[] }
```
Antall notater per tagg, case-insensitivt (visning = første skrivemåte), flest først. Nestede tagger telles
for seg.

### `GET /api/vaults/:vaultId/search?q=<tekst>&limit=<n>`
`limit` standard 20, maks 50. Tom `q` → tom liste. Felter vektes tittel > alias > innhold; prefiks- og
fuzzy-treff (MiniSearch).
```ts
interface SearchResponse { query: string; revision: Revision; hits: SearchHit[] }
interface SearchHit {
  path: DocPath; title: string; kind: 'note' | 'base';
  matchedField: 'title' | 'alias' | 'content' | 'tag';  // 'tag' = tillegg (taggsøk)
  alias?: string;                                       // når matchedField = 'alias'
  snippet?: { text: string; highlights: [number, number][] };  // når 'content'
  score: number;
}
```
Søk på `#tag` (starter med `#`) gir notater med taggen (inkl. nestede), case-insensitivt, med
`matchedField: 'tag'`, `score: 1`, sortert på tittel. Søket er diakritika-ufølsomt (æ→ae, ø→o/oe, å→a/aa).
Flere ord kombineres med AND, prefiks- og fuzzy-treff (ord > 4 tegn). Søkeindeksen bygges i bakgrunnen
etter at vaultet er klart; første søk venter på den.

### `GET /api/vaults/:vaultId/assets?path=<DocPath>`
Rå fil med riktig `Content-Type`. Kun indekserte filer med hvitelistet type (png, jpg/jpeg, gif, webp,
avif, svg, bmp, ico). Headere: `Cache-Control: no-cache`, `ETag` (mtime+size), `X-Content-Type-Options: nosniff`,
streng `Content-Security-Policy: sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'`
(se ADR-005). `If-None-Match` gir 304. 404 `ASSET_NOT_FOUND` ellers.

### `GET /api/events?vault=<VaultId>` – Server-Sent Events
`Content-Type: text/event-stream`. Én tilkobling per åpen fane/vault.

| `event:` | `data:` (JSON) | Når |
|---|---|---|
| `ready` | `ReadyEvent { vaultId, revision }` | Rett etter tilkobling (etter at indeksen er klar). |
| `changed` | `ChangedEvent { vaultId, revision, changes: { type: 'added'\|'changed'\|'removed', path: DocPath }[] }` | Etter hver debouncet endringsbunt. |

I tillegg `: ping` (kommentar) hvert **15.** s (PO-31). `changes[].path` er `DocPath`. Klienten: ved `changed` → `invalidateQueries(['vault', vaultId])`.
Ved `ready` med `revision` ≠ sist kjente → samme invalidering.

## Delte verdityper

```ts
type VaultValue =
  | { type: 'null' }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'date'; value: IsoDateTime; hasTime: boolean }
  | { type: 'list'; value: VaultValue[] }
  | { type: 'tag'; value: string }
  | { type: 'link'; target: DocPath | null; display: string };   // target null = brutt
```
Serveren tolker: `"[[x]]"` i frontmatter → `link`; `tags`-property → liste av `tag`; `YYYY-MM-DD` → `date`
(hasTime=false); ISO med tid → `date` (hasTime=true).

## Bases-resultat

```ts
interface BaseResult { views: BaseView[]; warnings: BaseWarning[] }
type BaseView = BaseTableView | BaseKanbanView | BaseUnsupportedView;

interface BaseTableView {
  type: 'table'; name: string;
  columns: BaseColumn[];                 // { id: 'file.name' | 'note.status' | 'formula.team', label, width? }
  groups: BaseGroup[];                   // uten groupBy: én gruppe { key: null, label: '' }
  grouped: boolean; indentProperties: boolean;
  totalRows: number; warnings: BaseWarning[];
}
interface BaseKanbanView {
  type: 'kanban'; name: string; groupBy: string;
  columns: BaseColumn[];                 // feltene som vises på hvert kort (fra `order`)
  groups: BaseGroup[];                   // kolonnene i ferdig rekkefølge, «(ingen)» sist
  totalRows: number; warnings: BaseWarning[];
}
interface BaseUnsupportedView { type: 'unsupported'; name: string; originalType: string; warnings: BaseWarning[] }

interface BaseGroup { key: VaultValue | null; label: string; rows: BaseRow[] }
interface BaseRow   { path: DocPath; cells: Record<string /* kolonne-id */, VaultValue> }
interface BaseWarning { code: string; message: string; source?: string }
```
Kolonne-id-er er **kanoniske**: bar `status` blir `note.status`. `columnSize`-nøkler normaliseres likt,
så `file.name: 553` og `note.status: 101` treffer riktige kolonner. Klienten skal ikke tolke uttrykk.

## HAST-kontrakt (`NoteDocument.content`)

`content` er en `hast` `Root` (JSON). Klienten rendrer med `toJsxRuntime(content, { Fragment, jsx, jsxs, components })`.

**Konvensjon:** egne elementer har tagnavn `vr-*`. All data ligger i `data-*`-attributter. I HAST-JSON
heter de camelCase (`properties.dataCalloutType`); i React-komponentens props kebab-case
(`props['data-callout-type']`). Verdier er alltid strenger. Barn er ferdig rendret og kommer som `children`.

Standard-HTML (overskrifter med `id`, avsnitt, lister, tabeller, `blockquote`, `img`, `code`, fotnoter fra
GFM, `input[type=checkbox][disabled]` i oppgavelister, `mark` for `==markering==`) brukes der det finnes.

### Lenker – `a`

| Attributt | Verdier | Merknad |
|---|---|---|
| `data-vr-link` | `internal` \| `unresolved` \| `external` \| `tag` | |
| `href` | `internal`: `/v/<vaultId>/<DocPath>[#anker]`. `unresolved`: utelatt. `external`: original-URL (kun http/https/mailto). `tag`: utelatt | Klienten bruker router-navigasjon for `internal`. |
| `data-vr-target` | `DocPath` | `internal` |
| `data-vr-anchor` | `overskrift-id` eller `^blokkid` | `internal`, valgfri |
| `data-vr-raw` | lenketeksten slik den står (`domene/Kunde#Mål`) | `unresolved` (for tooltip) |
| `data-vr-tag` | `task/x` (uten `#`) | `tag` – klienten åpner ⌘K med `#task/x` |

Eksterne lenker får i tillegg `rel="noopener noreferrer"` (klienten setter `target="_blank"`).

Tillegg (bakoverkompatible, kan ignoreres av klienten):

| Attributt | Når | Verdi |
|---|---|---|
| `data-vr-suggest`, `data-vr-suggest-title` | `unresolved` der et alias matcher (PO-7/PO-25) | `DocPath` og tittel – «Mente du *X*?» |
| `data-vr-ambiguous` | `internal`, flere filer matchet (PO-8/PO-26) | antall kandidater, f.eks. `"2"` |
| `data-vr-alternatives` | sammen med `data-vr-ambiguous` | JSON-liste med de andre kandidatenes `DocPath` |
| `data-vr-anchor-missing` | `internal`, ankeret finnes ikke i målet | `"true"` (lenken går til toppen, README-QA regel 7) |
| `data-vr-external-image` | `external` laget av et eksternt bilde (B10/PO-13) | `"true"` – vis som lenke med bildeikon |

- Visningstekst uten alias: `mål › anker` (f.eks. `Kafka-grunnleggende › Partisjoner`, `[[#X]]` → `X`).
- `data-vr-raw` er innholdet mellom klammene (`Finnes ikke|brutt`), for markdown-lenker `href`.
- `a` uten gyldig `href` i rå HTML (f.eks. `javascript:`) blir `span`. Fotnotelenker
  (`data-footnote-ref`/`-backref`) beholdes som de er.
- `href` for blokkankre beholder `^` (`/v/test/x#^offset-def`); overskriftsankre er URL-enkodet.

### Overskrifter, fotnoter, oppgaver

- `h1`–`h6` har `id` (github-slugger, unike i dokumentet). Innebygd innhold (`vr-embed`) har ingen
  overskrift- eller blokk-id-er (unngår duplikater).
- Fotnoter (GFM og inline `^[…]`) blir `section.footnotes[data-footnotes]` med `h2#user-content-footnote-label`
  = «Fotnoter» (PO-30); id-er/href-er har prefikset `user-content-`.
- Oppgavelister: `li.task-list-item > input[type=checkbox][disabled]`. Egendefinert status (`[/]`, `[-]` …)
  gir `checked` og `li[data-task="/"]`.
- Enkelt linjeskift i tekst blir `br` (PO-14).

### Blokk-id

Elementet som slutter med `^abc123` får `id="^abc123"` (markøren fjernes fra teksten).

### `vr-callout`

| Attributt | Verdier |
|---|---|
| `data-callout-type` | normalisert type, små bokstaver: `note`, `tip`, `warning`, `info`, `danger`, `quote`, `example`, `question`, `success`, `failure`, `bug`, `abstract`, `todo` – eller ukjent (vises som `note`) |
| `data-fold` | `none` \| `open` (`+`) \| `closed` (`-`) |

Barn: første barn er `vr-callout-title` (inline-innhold), deretter `vr-callout-body` med innholdet
(tom når calloutet bare har tittel). Nøstede callouts er tillatt. Aliaser normaliseres (`summary`→`abstract`
osv., QA-CAL-01); ukjent type sendes uendret i små bokstaver. Standardtittel når ingen er skrevet er norsk
(PO-14): Merk, Sammendrag, Info, Gjøremål, Tips, Fullført, Spørsmål, Advarsel, Feilet, Fare, Feil, Eksempel,
Sitat; ukjent type → typen med stor forbokstav.

### `vr-code`

| Attributt | Verdi |
|---|---|
| `data-lang` | språk-id slik forfatteren skrev det (`java`, `ts`), tom streng hvis ingen |
| `data-title` | filnavn/tittel fra meta, valgfri |
| `data-code` | rå kildetekst (til kopier-knappen) |

Barn: Shikis `pre.shiki > code > span.line > span[style="color:var(--shiki-token-…)"]` (`className` er en
liste). Tittel leses fra `title="…"`, `title:…` eller et bart filnavn i meta. Ukjent språk → ren tekst.
` ```dataview `/` ```dataviewjs ` blir `vr-unsupported[data-kind=dataview]`, ` ```tasks ` blir
`vr-unsupported[data-kind=other][data-name=tasks]`.

### `vr-mermaid`

`data-source` = diagramkilden. Ingen barn. Klienten rendrer (lazy) og håndterer feil og forstørring.

### `vr-embed`

| Attributt | Verdier |
|---|---|
| `data-status` | `ok` \| `missing` \| `cycle` \| `depth-limit` |
| `data-target` | `DocPath` (ved `ok`) |
| `data-anchor` | overskrift-id / `^blokkid`, valgfri |
| `data-title` | visningstittel (målets tittel, evt. `Tittel › Overskrift`) |
| `data-raw` | rå embed-tekst (ved `missing`) |

Barn ved `ok`: målets innhold (ferdig rendret HAST, samme kontrakt rekursivt). Ellers ingen barn.
Bilde-embeds blir **ikke** `vr-embed`, men `img` med `src="/api/vaults/<id>/assets?path=…"`,
`alt` (standard: filnavnet) og evt. `width`/`height` fra `![[bilde.png|300]]` / `|300x200` /
`|alt|300`. Markdown-bilder `![alt](sti)` går samme vei (sti relativ til notatet, så vault-rot).
Manglende bilde → `vr-embed[data-status=missing]` med `data-raw`. Eksterne bilder lastes aldri: de blir
`a[data-vr-link=external][data-vr-external-image=true]`.
Syklus: samme fil + samme anker allerede i stakken. Maks dybde **5** (PO-15). `![[x#Finnes ikke]]` → `missing`.
Embed av en `.base`-fil blir `vr-base`.

### `vr-base`

| Attributt | Verdi |
|---|---|
| `data-base-id` | nøkkel inn i `NoteDocument.bases` |
| `data-source-path` | `DocPath` til `.base`-fila hvis embed av fil; utelatt for ` ```base `-blokk |
| `data-view` | navn på view hvis embed med `#View`; ellers alle views som faner |

### `vr-unsupported`

`data-kind` = `latex` \| `canvas` \| `excalidraw` \| `dataview` \| `other`; `data-source` = kildeteksten
(avkortet til 2000 tegn). Vises som et diskret «ikke støttet»-kort.
Tillegg: `data-inline="true"` for inline-LaTeX `$…$` (vises rått, PO-13); `data-name` = kodeblokkspråket for
plugin-blokker; `data-target` = `DocPath` når kortet gjelder en fil (`![[Tegning.canvas]]`).

### Brutte lenker og embeds

Det finnes ikke et eget element: brutte lenker er `a[data-vr-link="unresolved"]` (AK9) og manglende embeds er
`vr-embed[data-status="missing"]`.

## Query-nøkler i klienten (TanStack Query)

Alle nøkler starter med `['vault', vaultId]` slik at én SSE-hendelse kan invalidere alt for et vault:

| Data | Nøkkel |
|---|---|
| vaults | `['vaults']` |
| tre | `['vault', vaultId, 'tree']` |
| dokument | `['vault', vaultId, 'document', docPath]` |
| søk | `['vault', vaultId, 'search', q]` |

## Eksempel

`GET /api/vaults/test/document?path=Velkommen` (forkortet):

```json
{
  "kind": "note",
  "vaultId": "test",
  "revision": 1,
  "path": "Velkommen",
  "filePath": "Velkommen.md",
  "title": "Velkommen",
  "mtime": "2026-11-05T14:00:00.000Z",
  "ctime": "2026-11-05T14:00:00.000Z",
  "aliases": ["Start"],
  "tags": ["meta"],
  "properties": [{ "key": "tags", "value": { "type": "list", "value": [{ "type": "tag", "value": "meta" }] } }],
  "toc": [{ "depth": 2, "text": "Kom i gang", "id": "kom-i-gang" }],
  "bases": {},
  "backlinks": [],
  "content": {
    "type": "root",
    "children": [
      { "type": "element", "tagName": "h2", "properties": { "id": "kom-i-gang" },
        "children": [{ "type": "text", "value": "Kom i gang" }] },
      { "type": "element", "tagName": "p", "properties": {}, "children": [
        { "type": "text", "value": "Se " },
        { "type": "element", "tagName": "a",
          "properties": { "href": "/v/test/domene/Kunde", "dataVrLink": "internal", "dataVrTarget": "domene/Kunde" },
          "children": [{ "type": "text", "value": "Kunde" }] }
      ] }
    ]
  }
}
```
