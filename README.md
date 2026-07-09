# biome-react-best-practices-plugin

[![npm version](https://img.shields.io/npm/v/biome-react-best-practices-plugin.svg)](https://www.npmjs.com/package/biome-react-best-practices-plugin)

A [Biome](https://biomejs.dev) plugin (written in
[GritQL](https://biomejs.dev/blog/gritql-biome)) that enforces React best
practices — catching the component-level mistakes that cause render loops,
remounted subtrees, and mutated props.

It draws on
[`biome-plugin-no-use-effect`](https://github.com/victorpatru/biome-plugin-no-use-effect)
and ports a structural subset of several ESLint rules:
[`react/no-unstable-nested-components`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unstable-nested-components.md),
the React Hooks _set-state-in-render_ check, and
[`react-compiler`](https://react.dev/learn/react-compiler) (props immutability).

> **v2.0.0** dropped the memoization-preservation rules — inline object/array/JSX
> props and `prefer-usecallback`. The
> [React Compiler](https://react.dev/learn/react-compiler) memoizes these
> automatically, so flagging them by hand is now noise. If you're not on the
> compiler yet, stay on
> [v1.x](https://www.npmjs.com/package/biome-react-best-practices-plugin/v/1.4.0).

```tsx
// flagged
useEffect(() => {
  fetchData(id);
}, [id]); // reach for derived state / a data library instead
function Parent() {
  function Child() {}
} // Child recreated every render — remounts its subtree
function Counter() {
  setCount(1);
} // setState during render — re-renders immediately
props.count = 5; // props are immutable

// safe
const active = items.filter((i) => i.active); // derive during render
function Child() {}
function Parent() {} // component at module scope
<button onClick={() => setCount((c) => c + 1)} />; // setter from a handler
const next = { ...props, count: 5 }; // copy instead of mutating
```

## Contents

- [Rules](#rules)
  - [no-use-effect](#no-use-effect)
  - [no-nested-component-definitions](#no-nested-component-definitions)
  - [no-set-state-in-render](#no-set-state-in-render)
  - [no-props-mutation](#no-props-mutation)
- [Usage](#usage)
- [Try it](#try-it)
- [Tests](#tests)
- [How it works](#how-it-works)
- [Releasing](#releasing)

## Rules

| Rule                                    | Flags                                                                                                                 | Why                                                                                                                                                                                    | Severity                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `react/no-use-effect`                   | any direct `useEffect(...)` call                                                                                      | Effects are the source of a large share of React bugs (stale closures, missing deps, cascades); most cases are better as derived state, event handlers, or a data library.             | warn                             |
| `react/no-nested-component-definitions` | a PascalCase function/arrow component defined inside another component                                                | The inner component is a new function every render, so React remounts its whole subtree — losing state and DOM.                                                                        | error                            |
| `react/no-set-state-in-render`          | a `setX(...)` state setter called during render                                                                       | Setting state during render re-renders immediately and can loop forever.                                                                                                               | error                            |
| `react/no-props-mutation`               | writing to `props.x` or calling a mutating array method on `props.x`                                                  | React and the React Compiler assume props are immutable; mutating them breaks memoization and produces inconsistent renders.                                                           | error                            |

Every rule reports a diagnostic only (category `plugin`) — no rule applies an
auto-fix, because the correct repair is context-specific.

> **Removed in v2.0.0** — the memoization-preservation rules
> (`no-inline-object-prop`, `no-inline-array-prop`, `no-jsx-as-prop`, and
> `prefer-usecallback`, plus its companion fixer script) were dropped. The
> [React Compiler](https://react.dev/learn/react-compiler) memoizes inline
> objects, arrays, JSX, and callbacks automatically, so flagging them is now
> noise. If you're not yet on the compiler and still want those checks, pin to
> `1.x` or use [`eslint-plugin-react-perf`](https://github.com/cvazac/eslint-plugin-react-perf).

### no-use-effect

```tsx
// flagged
useEffect(() => {
  fetchData(id);
}, [id]);

// safe — derive during render
const active = useMemo(() => items.filter((i) => i.active), [items]);
```

Every direct `useEffect(...)` call is flagged (severity `warn`). For a genuine
mount-only effect, route it through a dedicated wrapper (e.g. `useMountEffect`)
and suppress the rule there once:

```tsx
// biome-ignore lint/plugin: useMountEffect implementation
useEffect(effect, []);
```

### no-nested-component-definitions

```tsx
// flagged — Child and Inline are recreated every render
function Parent() {
  function Child() {
    return <div />;
  }
  const Inline = () => <span />;
  return (
    <div>
      <Child />
      <Inline />
    </div>
  );
}

// safe — module scope
function Child() {
  return <div />;
}
function Parent() {
  return <Child />;
}
```

Matches a PascalCase function declaration nested in another component, and a
PascalCase arrow (whose body contains JSX) assigned to a `const` nested in
another component. The ancestor match is made _strict_ with a
`$outer <: not $decl` guard, because Biome's `within` is reflexive (a node is
"within" itself) — without it, every top-level component would match itself as
its own parent.

### no-set-state-in-render

```tsx
// flagged — setter runs synchronously during render
function Comp() {
  const [count, setCount] = useState(0);
  setCount(1);
  return <div>{count}</div>;
}

// safe — deferred to a handler / effect
function Comp() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

Flags a `setX(...)` call (setter name matched as `set` + PascalCase) whose
**nearest enclosing function is the component or hook itself** — i.e. no other
function boundary sits between the call and the component. This is a structural
definition, so it excludes _every_ deferred case at once, without enumerating
shapes: named function declarations (`function handleClick() { setX() }`),
nested arrows/handlers (`const reset = () => setX()`), JSX event-handler values
(`onClick={() => setX()}`), and callbacks passed to another call
(`useEffect(() => setX())`, `items.map(() => setX())`, …). It covers all four
render-context forms — function and arrow/function-expression components, plus
function and arrow custom hooks (`useThing`) — since a setter run synchronously
during a hook's render is a render-phase update too.

### no-props-mutation

```tsx
props.count = 5; // flagged
props.items.push(1); // flagged (in-place array mutation)
const next = { ...props, count: 5 }; // safe — copy
```

Flags direct assignment to a `props.*` member and in-place array mutations
(`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`,
`copyWithin`) on a `props.*` member. This is a structural subset of the React
Compiler's immutability checks — it detects the most common violation, not the
full dataflow analysis the compiler performs. It also only tracks the literal
identifier `props`, not a destructured `{ config }`.

## Usage

Install the plugin as a dev dependency:

```sh
npm install -D biome-react-best-practices-plugin
```

Reference it from your Biome configuration:

```jsonc
{
  "plugins": ["biome-react-best-practices-plugin/react.grit"],
  "linter": {
    "rules": { "recommended": true }
  }
}
```

Then run the linter:

```sh
npx @biomejs/biome lint <files>
```

Requires Biome **2.0+** (GritQL plugins landed in v2.0). Developed and tested
against Biome 2.5.

> Using it directly from this repo instead? Set `"plugins": ["./react.grit"]`
> and point the path at the checked-out file.

## Try it

```sh
npm install
npx @biomejs/biome lint example.tsx
```

## Tests

Snapshot tests live in [tests/](tests/). Each case is a pair:
`tests/fixtures/<name>.tsx` (the source to lint) and `<name>.expected.json` (the
diagnostics it should produce, as an order-independent array of
`{ "line": <number>, "rule": "<slug>" }`). The runner
([scripts/run-tests.mjs](scripts/run-tests.mjs)) runs
`biome lint --reporter=json` on each fixture with only the plugin enabled and
compares the extracted diagnostics against the expectation.

```sh
npm test
```

Each rule has a flagged fixture and a safe counterpart: `useEffect` vs.
`useMemo`; nested vs. module-scope components; setState in render vs. in a
handler/effect; and props mutation vs. spread copy.

## How it works

The plugin is one Biome GritQL file, [react.grit](react.grit). A few
implementation notes worth knowing if you extend it:

- **Biome's GritQL regex is fully anchored** — `r"set[A-Z][a-zA-Z0-9_]*"` must
  match the _entire_ identifier, not a prefix. `r"^set[A-Z]"` would only match
  four-character names like `setN`.
- **`within` is reflexive** — a node matches itself. The nested-component rule
  adds `$outer <: not $decl` to force a strict ancestor.
- **Metavariable names must not start with `$__`** — a double underscore
  collides with GritQL's `$_` anonymous wildcard and fails to compile. This
  plugin uses a `$p`-prefix (`$pcomp`, `$po`) for internal names.

## Releasing

Versions and the changelog are managed with
[Changesets](https://github.com/changesets/changesets).

1. Add a changeset describing a change: `npx changeset`.
2. Commit the changeset to your branch.
3. On merge to `main`, the [Release workflow](.github/workflows/release.yml)
   opens a "Version Packages" pull request that bumps the version and updates
   `CHANGELOG.md`.
4. Merge that PR and the workflow publishes the new version to npm.

The workflow needs an `NPM_TOKEN` secret in the repo. CI runs the test suite on
every push and pull request
([.github/workflows/ci.yml](.github/workflows/ci.yml)).

---

Inspired by
[`biome-plugin-no-use-effect`](https://github.com/victorpatru/biome-plugin-no-use-effect),
[`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react),
and the [React Compiler](https://react.dev/learn/react-compiler).
