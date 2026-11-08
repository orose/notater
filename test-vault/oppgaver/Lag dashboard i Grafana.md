---
tags: [task]
status: Todo
priority: 2
due: 2026-11-10
---
# Lag dashboard i Grafana

Status er skrevet **`Todo`** med stor forbokstav. Sammenligning i Bases er case-sensitiv, så dette er *ikke* samme kolonne som `todo` i kanban.

```promql
sum by (topic) (rate(kafka_consumer_records_consumed_total[5m]))
```
