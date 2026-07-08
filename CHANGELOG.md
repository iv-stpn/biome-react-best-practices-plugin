# biome-react-best-practices-plugin

## 1.1.0

### Minor Changes

- 723d520: Initial release. A Biome GritQL plugin enforcing React best practices with eight rules: `no-use-effect`, `no-nested-component-definitions`, `no-set-state-in-render`, `no-props-mutation`, and the four `eslint-plugin-react-perf` inline-prop rules (`no-inline-object-prop`, `no-inline-array-prop`, `no-inline-function-prop`, `no-jsx-as-prop`).

### Patch Changes

- 9f3df52: Make `no-set-state-in-render` smarter about nested functions. A setter is now flagged only when its **nearest enclosing function is the component/hook itself** — the structural definition — instead of enumerating a fixed list of deferred shapes. This fixes false positives for setters inside named function declarations (`function handleClick() { setX() }`) and any other nested function within a component or hook. The rule also now covers custom hooks (`useThing`) and arrow/function-expression component forms, not just PascalCase function declarations.
