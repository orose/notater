---
tags: [task, team]
status: done
priority: 1
due: 2026-10-15
---
# Fiks flaky test i BetalingServiceTest

Årsak: testen var avhengig av `Instant.now()`. Løst med en injisert `Clock`.

```diff
-    var nå = Instant.now();
+    var nå = Instant.now(clock);
```
