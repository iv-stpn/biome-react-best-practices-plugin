---
"biome-react-best-practices-plugin": major
---

Remove the memoization-preservation rules: `react/no-inline-object-prop`, `react/no-inline-array-prop`, `react/no-jsx-as-prop`, and `react/prefer-usecallback` (along with its companion `fixers/prefer-usecallback.ts` codemod). These rules flagged inline object/array/JSX props and top-level render functions as hazards that defeat a memoized child's `React.memo` / `useMemo` / `useCallback`. The [React Compiler](https://react.dev/learn/react-compiler) memoizes these values and callbacks automatically, so hand-flagging them is now noise.

The plugin's remaining rules — `react/no-use-effect`, `react/no-nested-component-definitions`, `react/no-set-state-in-render`, and `react/no-props-mutation` — are unchanged.

**Migration:**

- If you're on the React Compiler, no action needed — the removed rules are redundant.
- If you're **not** on the compiler and still want these checks, pin to `1.x`, or use [`eslint-plugin-react-perf`](https://github.com/cvazac/eslint-plugin-react-perf) for the inline-prop rules.
- The `fix:prefer-usecallback` script and the `fixers/prefer-usecallback.ts` file no longer ship. Remove any reference to `bun run node_modules/biome-react-best-practices-plugin/fixers/prefer-usecallback.ts` from your scripts.
