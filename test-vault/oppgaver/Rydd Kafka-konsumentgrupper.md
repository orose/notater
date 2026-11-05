---
tags: [team]
status: todo
priority: 2
due: 2026-11-15
---
# Rydd Kafka-konsumentgrupper

#task/backend

Oppgave-taggen står **inline og nestet** (`task/backend`); `team` står i frontmatter. `file.hasTag("task")` skal matche.

```bash
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list \
  | grep -E '^(gammel|test)-' \
  | xargs -I{} kafka-consumer-groups.sh --bootstrap-server localhost:9092 --delete --group {}
```

Se [[Consumer groups]].
