---
tags: [task]
priority: 3
---
# Sett opp Flyway-migreringer

Mangler **både** `status` og `due`. Skal i kanban havne i kolonnen «(ingen)», og i Huskeliste sorteres sist blant prioritet 3.

```sql
-- V1__init.sql
CREATE TABLE kunde (
    kunde_id UUID PRIMARY KEY,
    navn     TEXT NOT NULL
);
```
