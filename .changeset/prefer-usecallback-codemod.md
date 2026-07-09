---
"biome-react-best-practices-plugin": minor
---

Rework `react/prefer-usecallback` from an unsafe GritQL auto-fix into a diagnostic-only rule plus an opt-in codemod. **Behavioral change from 1.2.0:** the rule no longer applies a fix under `biome lint --write --unsafe` — it only reports diagnostics. The repair now ships as a standalone script you run yourself, after `biome check --write .`:

```sh
bun run node_modules/biome-react-best-practices-plugin/fixers/prefer-usecallback.ts [paths...]
```

Why the change: the auto-fix needed to add the `useCallback` import, but synthesizing an import (or rewriting a default `import React`) is not expressible safely in Biome's GritQL — the rewrite re-matches its own output and loops forever under `--write`. Moving the fix into a script makes it correct, idempotent, and opt-in.

The codemod collects the rule's diagnostics from Biome (so it fixes exactly what the rule flags), wraps each reported function in `useCallback(fn, [])` — preserving `async`/generators via a named function expression, and converting a `function` declaration to a `const` binding — and ensures `useCallback` is imported from React (augmenting an existing named import, adding a named clause to a default-only `import React`, or prepending a fresh import line). It is idempotent (an already-wrapped function no longer matches), supports `--dry-run`, and always leaves the dependency array empty (`[]`) for you to complete, since computing real dependencies needs dataflow analysis it does not attempt.
