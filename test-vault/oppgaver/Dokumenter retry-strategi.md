---
status: done
priority: 3
due: 2026-10-01
---
# Dokumenter retry-strategi

Tagget **kun inline**: #task

Vi bruker eksponentiell backoff med jitter, og sender til DLT etter 5 forsøk. Se [[Hendelsesdrevet arkitektur#Feilhåndtering]].
