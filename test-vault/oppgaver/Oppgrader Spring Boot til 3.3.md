---
tags: [task]
status: todo
priority: 1
due: 2026-11-20
---
# Oppgrader Spring Boot til 3.3

Filnavnet inneholder **punktum** (`3.3`). `file.name` skal være `Oppgrader Spring Boot til 3.3` – bare `.md` fjernes.

- [ ] Oppdater `spring-boot-starter-parent`
- [ ] Kjør `./mvnw versions:display-dependency-updates`
- [ ] Sjekk [[Spring Boot – konfigurasjon]] for utgåtte properties

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
    <relativePath/>
</parent>
```
