---
tags: [task]
status: todo
priority: 10
due: 2026-12-15
---
# Refaktorer logging

`priority: 10` – fanger feil der prioritet sorteres som tekst (`"10" < "2"`). Skal komme **etter** prioritet 3.

```java
private static final Logger log = LoggerFactory.getLogger(OrdreService.class);
```
