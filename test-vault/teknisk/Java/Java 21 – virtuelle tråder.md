---
tags: [java]
aliases: [Virtuelle tråder, Loom]
---
# Java 21 – virtuelle tråder

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000).forEach(i ->
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return i;
        }));
}
```

> [!warning] Pinning
> `synchronized`-blokker rundt blokkerende I/O «pinner» bæretråden (før JDK 24). Bruk `ReentrantLock`.

Spring Boot 3.2+: `spring.threads.virtual.enabled=true`.
