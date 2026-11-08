---
tags: [task]
status: todo
due: 2026-11-10
---
# Undersøk minnelekkasje

Mangler `priority`. Skal sorteres **etter** alle med prioritet i Huskeliste.

```bash
jcmd $(pgrep -f ordre-service) GC.heap_dump /tmp/ordre.hprof
```
