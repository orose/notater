---
tags: [sprint]
sprint: 12
---
# Sprintoversikt

Notat med **inline ` ```base `-blokker**. Fasit i `docs/test/bases-fasit.md` (seksjon «Sprintoversikt»).

## Prioritet 1 i oppgavemappen

```base
filters:
  and:
    - file.inFolder("oppgaver")
    - file.hasTag("task")
    - priority == 1
views:
  - type: table
    name: Kritisk
    order:
      - file.name
      - status
      - due
    sort:
      - property: due
        direction: DESC
```

## Teamets oppgaver som kanban (or-filter og not)

```base
filters:
  or:
    - file.hasTag("team")
    - file.inFolder("prosjekter")
views:
  - type: kanban
    name: Team
    filters:
      and:
        - file.hasTag("task")
        - not:
            - status == "done"
    groupBy:
      property: status
      direction: ASC
    groupOrder:
      - todo
      - doing
    order:
      - file.name
      - due
```

## Ukjent funksjon og ukjent nøkkel

Forventet: viewet rendres så godt det lar seg gjøre, med en **diskret advarsel** om ukjent funksjon/nøkkel. Ingen krasj.

```base
filters:
  and:
    - file.hasTag("task")
    - file.finnesIkke("x")
views:
  - type: table
    name: Med feil
    ukjentNøkkel: 123
    order:
      - file.name
  - type: gallery
    name: Ukjent view-type
```

## Ugyldig YAML

```base
filters:
  and:
    - file.hasTag("task"
views: [
```

Forventet: feilkort i blokken («Kunne ikke lese base-definisjonen»), resten av notatet vises.
