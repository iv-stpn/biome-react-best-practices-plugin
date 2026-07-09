---
"biome-react-best-practices-plugin": minor
---

Remove the `react/no-inline-function-prop` rule. It flagged inline function props (arrow functions and function expressions) passed to a custom component — but Biome ships its own [`lint/performance/noJsxPropsBind`](https://biomejs.dev/linter/rules/no-jsx-props-bind/) (since v2.3.11) covering exactly this ground, and more: it also catches `.bind()` in JSX props, and it fires on host elements as well as custom components. Keeping our rule only produced duplicate diagnostics for the arrow/function-expression cases.

**Migration:** enable `noJsxPropsBind` in your Biome config to keep catching inline function props:

```json
{
  "linter": {
    "rules": {
      "performance": { "noJsxPropsBind": "warn" }
    }
  }
}
```

The other three `eslint-plugin-react-perf` inline-prop rules — `no-inline-object-prop`, `no-inline-array-prop`, and `no-jsx-as-prop` — stay, since Biome has no built-in equivalent for object, array, or JSX-element props. Those three continue to fire only on custom (PascalCase) components.
