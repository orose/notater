---
tags: [sql, postgres]
---
# Indekser i PostgreSQL

## B-tre

Standard. Støtter `=`, `<`, `>`, `BETWEEN`, `ORDER BY`.

## Delvise indekser

```sql
CREATE INDEX CONCURRENTLY idx_ordre_betalt_opprettet
    ON ordre (opprettet DESC)
    WHERE status = 'BETALT';
```

## Datamodell

```mermaid
erDiagram
    KUNDE ||--o{ ORDRE : legger_inn
    ORDRE ||--|{ ORDRELINJE : inneholder
    PRODUKT ||--o{ ORDRELINJE : refereres_av
    ORDRE ||--o| BETALING : betales_med
    KUNDE {
        uuid kunde_id PK
        text navn
        text epost
    }
    ORDRE {
        uuid ordre_id PK
        uuid kunde_id FK
        varchar status
        timestamptz opprettet
    }
    ORDRELINJE {
        uuid ordre_id FK
        text sku FK
        int antall
    }
```
