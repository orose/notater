# Bases fra kundens vault (fasit)

Disse to skal fungere identisk med Obsidian. QA lager matchende notater i testvaultet.

## 1. `Domene.base`

```yaml
filters:
  and:
    - file.inFolder("domene")
    - file.ext == "md"
    - file.name != "_MOC"
    - '!file.hasTag("kafka-topic")'
views:
  - type: table
    name: Domene
    order:
      - file.name
    sort:
      - property: file.name
        direction: ASC
```

## 2. `Oppgaver.base`

```yaml
filters:
  and:
    - file.hasTag("task")
    - file.folder != "templates"
formulas:
  team: if(file.hasTag("team"), "Testgjengen", "Mine oppgaver")
views:
  - type: table
    name: Huskeliste
    filters:
      and:
        - status != "done"
    groupBy:
      property: formula.team
      direction: ASC
    order:
      - file.name
      - status
      - due
    sort:
      - property: priority
        direction: ASC
      - property: due
        direction: ASC
    columnSize:
      file.name: 553
      note.status: 101
  - type: kanban
    name: Kanban
    groupBy:
      property: status
      direction: ASC
    groupOrder:
      - todo
      - doing
      - done
    order:
      - file.name
      - file.tags
  - type: table
    name: Arkiv
    filters:
      and:
        - status == "done"
    order:
      - file.name
      - status
      - file.mtime
    sort:
      - property: file.mtime
        direction: ASC
    indentProperties: false
```

## Merknader fra PO
- `file.tags`/`file.hasTag` dekker både frontmatter-`tags` og inline `#tags`. `hasTag("task")` matcher også nestede tagger som `#task/x` (som Obsidian).
- `file.name` er filnavn uten extension.
- Kanban: kort uten verdi for `groupBy`-property havner i en egen kolonne «(ingen)» til slutt. Verdier som ikke står i `groupOrder` legges etter de oppførte, alfabetisk.
- `columnSize` respekteres på desktop; på mobil får tabellen intern horisontal scroll.
