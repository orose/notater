# ADR-004: Vault-indeks i minnet, lenkeoppløsning og live reload

- Status: Vedtatt (arkitekt), 2026-11-05

## Kontekst

Filsystemet er kilden til sannhet (B2). Vi trenger rask navigasjon (< 200 ms), backlinks, søk, Bases og
live reload når kunden redigerer i Obsidian (AK12). ~2000 notater skal indekseres på < 3 s (AK17).

## Beslutning

### Vault-register og indeks

- `vault-registry` holder én `VaultIndex` per konfigurert vault, **opprettet lat** ved første forespørsel
  (standard-vaultet indekseres ved oppstart). Det finnes ingen «aktivt vault»-tilstand på serveren – vault-id
  står i hver URL. Bytte av vault i UI er bare navigasjon.
- Skanning: `fs.promises.readdir(rot, { recursive: true, withFileTypes: true })`. Ignorerer `.obsidian/`,
  `.trash/`, `.git/`, `node_modules/` og alt som starter med `.`, pluss `ignore`-prefikser fra konfig.
  Symlenker som peker ut av vaultet ignoreres (`realpath`-sjekk).
- Per fil: `VaultFile { filePath, docPath, ext, basename, folder, size, mtime, ctime }`.
- Per `.md` i tillegg `NoteMeta`: frontmatter (YAML core), aliaser, tagger (frontmatter + inline, uten `#`,
  normalisert til små bokstaver for oppslag men original casing for visning), overskrifter (tekst + slug),
  blokk-id-er, utgående lenker/embeds (rå mål, anker, posisjon) og ren tekst for søk.
- Metadata hentes med **samme remark-parser** som renderingen (riktig håndtering av kode, escaping osv.),
  men uten rehype/Shiki. Filer leses med begrenset parallellitet (f.eks. 32 samtidige).
- **Ytelsesrisiko:** remark er ikke den raskeste parseren. Første utvikleroppgave i slice 0 er en benchmark
  mot QAs genererte 2000-notaters vault. Hvis > 2 s: flytt metadata-uttrekk til en `worker_threads`-pool
  (grensesnittet `extractNoteMeta(text): NoteMeta` er rent nettopp for å gjøre dette trivielt).
- Avledede strukturer bygges etter skanning og oppdateres inkrementelt: navneoppslag (basename → filer),
  backlink-graf (mål → kilder), tag-indeks, MiniSearch-indeks.
- `revision` øker for hver anvendte endringsbunt.

### Lenkeoppløsning (som Obsidian)

`resolveLink(linkpath, fromFilePath): VaultFile | null` – ren funksjon over navneoppslaget:

1. Normaliser: trim, fjern `#anker` og `|alias`, URL-dekod `%20` (markdown-lenker), POSIX-separatorer.
2. **Eksakt sti** fra vault-rot (case-insensitiv), med og uten `.md`.
3. **Relativ sti** fra kildens mappe hvis lenken starter med `./` eller `../` (aldri ut av vaultet).
4. **Sti-suffiks / basename**: alle filer der `filePath` (uten `.md` for notater) slutter på `/<linkpath>` eller
   er lik `linkpath`, case-insensitivt. Ved flere treff: (a) samme mappe som kilden, (b) korteste sti,
   (c) alfabetisk. Dette gir «korteste unike sti»-oppførselen.
5. Ellers: **brutt lenke** (`target: null`), vises etter AK9.

**Aliaser:** Obsidian løser *ikke* `[[Alias]]` til en fil – aliaser brukes til autofullføring (som skriver
`[[Fil|Alias]]`) og søk. Vi følger Obsidian: aliaser inngår i ⌘K-søk, men ikke i lenkeoppløsning.
Se «Utfordringer til PO» i rapporten/beslutninger.md.

Ankere: `#Overskrift` matches mot overskriftstekst case-insensitivt (og `#H1#H2` → siste ledd);
`#^id` mot blokk-id. Ukjent anker → lenken fungerer, men lander øverst (ikke markert som brutt).

### Filovervåking og live reload

- `chokidar` v4 per indeksert vault, `ignoreInitial: true`, samme ignore-regler som skanningen,
  `awaitWriteFinish` (stabilitetsterskel ~100 ms) fordi Obsidian skriver i flere steg.
- Hendelser samles (debounce **150 ms**) til én bunt → indeksen oppdateres inkrementelt (les/parse kun berørte
  filer, oppdater avledede strukturer) → `revision++` → render-cachen tømmes → SSE `changed`.
- Klienten har **én** `EventSource('/api/events?vault=<id>')`. Ved `changed` kalles
  `queryClient.invalidateQueries({ queryKey: ['vault', vaultId] })`. Aktivt notat, tre og backlinks
  hentes på nytt; scroll-posisjon beholdes. Ved `ready` med høyere revision enn klienten kjenner
  (etter frakobling) invalideres alt.
- Heartbeat: SSE-kommentar `: ping` hvert 25. sekund. `EventSource` reconnecter selv.

Vi valgte bort `fs.watch` direkte (ujevn oppførsel på tvers av plattformer ved atomiske skriv/rename) og
WebSocket (enveis push er nok; SSE er enklere og fungerer med vanlig HTTP).

## Konsekvenser

- + Ingen database, ingen persistent cache – oppstart er alltid konsistent med disken.
- + Lenkeoppløsning, backlinks og Bases er rene funksjoner over indeksen → godt testbare.
- − Minnebruk: ~2000 notater × (metadata + tekst for søk) ≈ titalls MB. Akseptabelt.
- − Full re-indeksering ved endring av konfig krever omstart (v1).
