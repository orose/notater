---
tags: [task, team]
status: doing
priority: 2
due: 2026-11-09
---
# Optimaliser SQL-spørring

Ligger **dypt nestet** (`prosjekter/2026/q4/backend/sprint-12/`). Skal med i oppgavebasen (filteret ser bare på `file.folder != "templates"`).

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.ordre_id, o.status, k.navn
FROM ordre o
JOIN kunde k ON k.kunde_id = o.kunde_id
WHERE o.status = 'BETALT'
  AND o.opprettet >= now() - interval '7 days'
ORDER BY o.opprettet DESC
LIMIT 50;
```

Forslag: delvis indeks. Se [[Indekser i PostgreSQL#Delvise indekser]].
