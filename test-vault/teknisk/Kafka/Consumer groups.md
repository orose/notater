---
tags: [kafka]
---
# Consumer groups

Konsumenter med samme `group.id` deler partisjonene i et topic mellom seg. Se [[Kafka-grunnleggende#Partisjoner]] og blokken om offset: [[Kafka-grunnleggende#^offset-def|offset-definisjonen]].

```yaml
spring:
  kafka:
    consumer:
      group-id: ordre-service
      auto-offset-reset: earliest
      enable-auto-commit: false
    listener:
      ack-mode: record
```

```sequenceDiagram
Dette er IKKE mermaid – språknavnet er feil brukt som kodeblokk-språk og skal vises som vanlig kode.
```

![[Kafka-grunnleggende#^offset-def]]
