# ADR-003: Bases – egen parser og evaluator på serveren

- Status: Vedtatt (arkitekt), 2026-11-05

## Kontekst

Bases (`.base`-filer og ` ```base `-blokker) er YAML med et lite uttrykksspråk i filtre og formler.
Begge kundeeksemplene i `docs/produkt/bases-eksempler.md` skal gi samme resultat som Obsidian.
Ukjente funksjoner/nøkler skal ikke krasje, men gi en diskret advarsel. `eval()`/`new Function()` er utelukket.

## Beslutning

**Evaluering skjer på serveren** (der indeksen er). Klienten får et ferdig `BaseResult`: views → grupper →
rader → typede celleverdier (`VaultValue`). Klienten sorterer/filtrerer ikke selv.

Modulen `src/server/features/bases/` deles i rene, uavhengige deler:

```
bases/
  expression/
    lexer.ts          tekst → tokens
    parser.ts         tokens → Expr-AST (Pratt-parser, presedens under)
    evaluate.ts       (Expr, EvalContext) → Value      – ren funksjon, ingen I/O
    functions.ts      register: globale funksjoner + metoder per verditype
    values.ts         Value-typer, sammenligning, sannhetsverdi, tostring
  definition/
    parse-base.ts     YAML-tekst → BaseDefinition + advarsler (tolerant, aldri throw)
  query/
    run-base.ts       (BaseDefinition, RecordSource) → BaseResult
    property-ref.ts   «status» | «note.status» | «file.name» | «formula.team» → PropertyRef
    group-and-sort.ts
  bases-routes.ts / index.ts
```

`RecordSource` er et lite grensesnitt (`listRecords(): Iterable<BaseRecord>` + lenkeoppløsning) som
vault-indeksen implementerer. Bases avhenger dermed ikke av indeks-implementasjonen (DIP), og hele
evaluatoren kan testes med håndlagde poster.

### Uttrykksspråket (v1)

Grammatikk (lavest til høyest presedens):

| Nivå | Operatorer |
|---|---|
| 1 | `\|\|` |
| 2 | `&&` |
| 3 | `==` `!=` |
| 4 | `<` `>` `<=` `>=` |
| 5 | `+` `-` |
| 6 | `*` `/` `%` |
| 7 | unær `!` `-` |
| 8 | medlem `a.b`, kall `f(x)`, metodekall `a.b(x)`, indeks `a[0]` |

Primærer: strenglitteraler (`"…"` og `'…'` med `\`-escape), tall, `true`/`false`/`null`, identifikatorer,
`( … )`, listelitteral `[a, b]`.

Navnerom: `file.*`, `note.*`, `formula.*`; bar identifikator = `note.<navn>`. Property-navn med mellomrom
nås via `note["mitt felt"]`.

Minimum i v1 (fra briefen) + åpenbare naboer:

- `file`: `name` (uten endelse), `basename`, `path`, `folder`, `ext`, `size`, `ctime`, `mtime`, `tags`, `links`;
  metoder `inFolder(f)` (inkl. undermapper), `hasTag(...t)` (matcher også nestede: `task` ⊇ `task/x`),
  `hasLink(x)`, `hasProperty(p)`.
- Globale: `if(c, a, b?)`, `now()`, `today()`, `date(s)`, `number(x)`, `list(x)`, `link(p)`.
- Streng/liste: `contains`, `startsWith`, `endsWith`, `lower`, `upper`, `length`, `isEmpty`.

Ukjent funksjon/metode → verdien `null` + `BaseWarning { code: 'unknown-function' }` (én advarsel per
unikt uttrykk, ikke per rad). Parse-feil i et filter → filteret ignoreres (alle rader slipper gjennom) +
advarsel `parse-error`. **Begrunnelse:** å skjule alt ved feil er mer forvirrende enn å vise for mye.

### Filtre

`filters` er enten en uttrykksstreng eller `{ and | or | not: [ … ] }`, vilkårlig nøstet. `not: [a, b]`
betyr «ingen av» (= `!(a || b)`), som i Obsidian. Globale filtre og view-filtre kombineres med `and`.

### Semantikk for verdier

- Sammenligning mellom ulike typer: `==` er `false`, `<`/`>` er `false`. Mangler property → `null`.
  `null != "done"` er `true` (slik at notater uten status kommer med i «Huskeliste»).
- Datoer: frontmatter-strenger på formen `YYYY-MM-DD` / ISO tolkes som dato ved sammenligning og sortering.
- Sortering: flere nøkler, `ASC`/`DESC`, null **sist** uansett retning, strenger med `Intl.Collator('nb', { numeric: true, sensitivity: 'base' })`.
- `groupBy` + `direction` sorterer gruppene. Kanban: `groupOrder` først, deretter øvrige verdier alfabetisk,
  «(ingen)» sist (PO-regel). Liste-verdier i groupBy: raden havner i gruppen for listens tekstrepresentasjon (v1).

### View-typer

`table` og `kanban` støttes. Andre typer (`cards`, `list`, `map` …) → `BaseUnsupportedView` som vises som
«ikke støttet»-kort i fanen, uten å påvirke andre views.

Merk: `kanban` er ikke en innebygd Bases-view i Obsidian, men kommer fra en plugin. Vi implementerer
semantikken som er beskrevet i bases-eksempler.md + PO-merknadene, ikke en plugin-spesifikk oppførsel.

## Konsekvenser

- + Ingen kodeinjeksjon mulig; full kontroll på semantikk og feilmeldinger.
- + Lexer/parser/evaluator er rene funksjoner → raske, deterministiske tester (TDD-vennlig).
- − Vi må selv holde tritt med Obsidians uttrykksspråk. Utvidelser = nye oppføringer i funksjonsregisteret (OCP).
- − Semantikkdetaljer (f.eks. `file.folder` for rotmappen, typesammenligning) er antakelser – se
  `docs/beslutninger.md` – og bør verifiseres mot ekte Obsidian av QA.
