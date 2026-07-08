---
"biome-react-best-practices-plugin": patch
---

Make `no-set-state-in-render` smarter about nested functions. A setter is now flagged only when its **nearest enclosing function is the component/hook itself** — the structural definition — instead of enumerating a fixed list of deferred shapes. This fixes false positives for setters inside named function declarations (`function handleClick() { setX() }`) and any other nested function within a component or hook. The rule also now covers custom hooks (`useThing`) and arrow/function-expression component forms, not just PascalCase function declarations.
