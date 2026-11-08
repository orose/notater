---
aliases: [Spring-konfig]
tags: [spring, java]
---
# Spring Boot – konfigurasjon

Filnavnet har tankestrek (–, U+2013) og mellomrom.

## application.yaml

```yaml title="src/main/resources/application.yaml"
server:
  port: 8080
  shutdown: graceful
spring:
  application:
    name: ordre-service
  datasource:
    url: jdbc:postgresql://localhost:5432/ordre
    username: ${DB_USER:ordre}
    password: ${DB_PASSWORD}
management:
  endpoints:
    web:
      exposure:
        include: health,info,prometheus
```

## Typesikker konfig

```java title:OrdreProperties.java
@ConfigurationProperties(prefix = "ordre")
@Validated
public record OrdreProperties(
        @NotNull Duration reservasjonTtl,
        @Min(1) int maksLinjer) {
}
```

> [!note] Kodeblokk-titler
> Over brukes to vanlige konvensjoner for filnavn i kodeblokk: `title="..."` og `title:...`. Begge bør gi filnavn-merke (AK14).
