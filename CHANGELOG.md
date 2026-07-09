# biome-react-best-practices-plugin

## 1.3.0

### Minor Changes

- 67b086a: Rework `react/prefer-usecallback` from an unsafe GritQL auto-fix into a diagnostic-only rule plus an opt-in codemod. **Behavioral change from 1.2.0:** the rule no longer applies a fix under `biome lint --write --unsafe` — it only reports diagnostics. The repair now ships as a standalone script you run yourself, after `biome check --write .`:

  ```sh
  bun run node_modules/biome-react-best-practices-plugin/fixers/prefer-usecallback.ts [paths...]
  ```

  Why the change: the auto-fix needed to add the `useCallback` import, but synthesizing an import (or rewriting a default `import React`) is not expressible safely in Biome's GritQL — the rewrite re-matches its own output and loops forever under `--write`. Moving the fix into a script makes it correct, idempotent, and opt-in.

  The codemod collects the rule's diagnostics from Biome (so it fixes exactly what the rule flags), wraps each reported function in `useCallback(fn, [])` — preserving `async`/generators via a named function expression, and converting a `function` declaration to a `const` binding — and ensures `useCallback` is imported from React (augmenting an existing named import, adding a named clause to a default-only `import React`, or prepending a fresh import line). It is idempotent (an already-wrapped function no longer matches), supports `--dry-run`, and always leaves the dependency array empty (`[]`) for you to complete, since computing real dependencies needs dataflow analysis it does not attempt.

## 1.2.0

### Minor Changes

- 9942364: Add `react/prefer-usecallback` (warn) — the plugin's first rule with an auto-fix. It flags any function created at the top level of a component/hook body (an arrow or function expression assigned to a `const`, or a `function` declaration) and wraps it in `useCallback`. The scope mirrors `no-set-state-in-render` (nearest enclosing function must be the component/hook itself), and names that are themselves a component or hook (PascalCase / `use*`) are excluded.

  The auto-fix is deliberately **`unsafe`** (applied only with `biome lint --write --unsafe`, shown as a suggestion otherwise): GritQL cannot compute the dependency array (it inserts an empty `[]` you must complete), does not add the `useCallback` import, and converts a `function` declaration to a `const` (changing hoisting).

  Also adds an npm version badge to the README, and a husky `pre-commit` hook that runs lint, typecheck, and tests before every commit.

## 1.1.0

### Minor Changes

- 723d520: Initial release. A Biome GritQL plugin enforcing React best practices with eight rules: `no-use-effect`, `no-nested-component-definitions`, `no-set-state-in-render`, `no-props-mutation`, and the four `eslint-plugin-react-perf` inline-prop rules (`no-inline-object-prop`, `no-inline-array-prop`, `no-inline-function-prop`, `no-jsx-as-prop`).

### Patch Changes

- 9f3df52: Make `no-set-state-in-render` smarter about nested functions. A setter is now flagged only when its **nearest enclosing function is the component/hook itself** — the structural definition — instead of enumerating a fixed list of deferred shapes. This fixes false positives for setters inside named function declarations (`function handleClick() { setX() }`) and any other nested function within a component or hook. The rule also now covers custom hooks (`useThing`) and arrow/function-expression component forms, not just PascalCase function declarations.
