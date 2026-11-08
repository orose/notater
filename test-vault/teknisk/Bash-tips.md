---
tags: [bash, verktøy]
---
# Bash-tips

> [!important] Negativ tag-test
> Dette notatet inneholder teksten `#task` **kun i kode** (inline-kode og kodeblokk). Det skal **ikke** bli tagget `task` og skal **ikke** vises i [[Oppgaver.base]]. Det inneholder også taggen #taskforce, som heller ikke er `task`.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Finn alle notater med #task
grep -rl "#task" ~/vault --include='*.md' | sort

for f in *.md; do
  echo "Behandler: ${f%.md}"
done
```

```sh
# uten språknavn «bash», men «sh»
find . -name '*.log' -mtime +7 -delete
```

Inline: `grep '#task'`.

URL med fragment skal ikke bli tagg: https://example.com/side#task
