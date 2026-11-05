---
tags: [qa, mermaid]
---
# Mermaid-galleri

Én av hver diagramtype. Alle skal følge temaet (lys/mørk) og re-rendres ved temabytte (AK15). Det siste er bevisst ugyldig.

## Flowchart

```mermaid
flowchart TD
    Start([Ny ordre]) --> Valider{Gyldig?}
    Valider -- nei --> Avvis[Returner 400]
    Valider -- ja --> Lagre[(Lagre i Postgres)]
    Lagre --> Publiser[/Publiser OrdreOpprettet/]
    Publiser --> Slutt([Ferdig])
```

## Sekvensdiagram

```mermaid
sequenceDiagram
    actor Kunde
    participant Web
    participant Ordre as ordre-service
    participant Betaling as betaling-service
    Kunde->>Web: Klikk «Betal»
    Web->>Ordre: POST /api/ordre
    Ordre-->>Web: 201 Created
    Ordre-)Betaling: OrdreOpprettet (Kafka)
    Note over Ordre,Betaling: Asynkront – minst én gang
    alt Betaling OK
        Betaling-)Ordre: BetalingMottatt
    else Avvist
        Betaling-)Ordre: BetalingAvvist
    end
```

## Klassediagram

```mermaid
classDiagram
    class Ordre {
        +UUID ordreId
        +Status status
        +List~Ordrelinje~ linjer
        +betal(Betaling b) void
    }
    class Ordrelinje {
        +String sku
        +int antall
    }
    Ordre "1" *-- "1..*" Ordrelinje
```

## ER-diagram

```mermaid
erDiagram
    KUNDE ||--o{ ORDRE : har
    ORDRE ||--|{ ORDRELINJE : består_av
```

## Tilstandsdiagram

```mermaid
stateDiagram-v2
    [*] --> todo
    todo --> doing
    doing --> done
    doing --> blocked
    blocked --> doing
    done --> [*]
```

## Gantt

```mermaid
gantt
    title Sprint 12
    dateFormat  YYYY-MM-DD
    section Backend
    Migrer til Java 21        :active, j21, 2026-11-02, 6d
    Optimaliser SQL-spørring  :sql, after j21, 3d
    section Test
    Integrasjonstest ordre-API :it, 2026-11-05, 7d
```

## Ugyldig diagram

Forventet: en tydelig, men diskret feilmelding *i blokken* (f.eks. «Kunne ikke tegne diagrammet») med kildekoden synlig. Resten av siden skal rendres normalt, og Mermaid skal **ikke** legge igjen feil-SVG-er nederst i `<body>`.

```mermaid
flowchart LR
    A --> B -->
    C[[uavsluttet
    }}} dette er ikke mermaid
```

## Etter feilen

Denne seksjonen skal vises – en feil i ett diagram stopper ikke resten. Se også [[Stort mermaid-diagram]].

```mermaid
pie title Fordeling av oppgavestatus
    "todo" : 7
    "doing" : 3
    "done" : 4
    "annet" : 3
```
