---
"biome-react-best-practices-plugin": minor
---

Add `react/prefer-usecallback` (warn) — the plugin's first rule with an auto-fix. It flags any function created at the top level of a component/hook body (an arrow or function expression assigned to a `const`, or a `function` declaration) and wraps it in `useCallback`. The scope mirrors `no-set-state-in-render` (nearest enclosing function must be the component/hook itself), and names that are themselves a component or hook (PascalCase / `use*`) are excluded.

The auto-fix is deliberately **`unsafe`** (applied only with `biome lint --write --unsafe`, shown as a suggestion otherwise): GritQL cannot compute the dependency array (it inserts an empty `[]` you must complete), does not add the `useCallback` import, and converts a `function` declaration to a `const` (changing hoisting).

Also adds an npm version badge to the README, and a husky `pre-commit` hook that runs lint, typecheck, and tests before every commit.
