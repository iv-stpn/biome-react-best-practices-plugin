# biome-react-best-practices-plugin

A [Biome](https://biomejs.dev) plugin (written in [GritQL](https://biomejs.dev/blog/gritql-biome)) that
enforces React best practices — catching the component-level mistakes that cause render loops, remounted
subtrees, and mutated props, plus the inline props that quietly defeat memoization.

It draws on [`biome-plugin-no-use-effect`](https://github.com/victorpatru/biome-plugin-no-use-effect) and ports
a structural subset of several ESLint rules: [`react/no-unstable-nested-components`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-unstable-nested-components.md),
the React Hooks *set-state-in-render* check, [`react-compiler`](https://react.dev/learn/react-compiler)
(props immutability), and [`eslint-plugin-react-perf`](https://github.com/cvazac/eslint-plugin-react-perf)
(inline object/array/function/JSX props).

```tsx
// flagged
useEffect(() => { fetchData(id); }, [id]);        // reach for derived state / a data library instead
function Parent() { function Child() {} }          // Child recreated every render — remounts its subtree
function Counter() { setCount(1); }                // setState during render — re-renders immediately
props.count = 5;                                   // props are immutable
<Widget style={{ color: "red" }} />                // new object every render — defeats memoization

// safe
const active = items.filter((i) => i.active);      // derive during render
function Child() {}  function Parent() {}           // component at module scope
<button onClick={() => setCount(c => c + 1)} />     // setter from a handler
const next = { ...props, count: 5 };                // copy instead of mutating
<Widget style={STABLE_STYLE} />                     // hoisted / memoized reference
```

## Rules

| Rule | Flags | Why | Severity |
| --- | --- | --- | --- |
| `react/no-use-effect` | any direct `useEffect(...)` call | Effects are the source of a large share of React bugs (stale closures, missing deps, cascades); most cases are better as derived state, event handlers, or a data library. | warn |
| `react/no-nested-component-definitions` | a PascalCase function/arrow component defined inside another component | The inner component is a new function every render, so React remounts its whole subtree — losing state and DOM. | error |
| `react/no-set-state-in-render` | a `setX(...)` state setter called during render | Setting state during render re-renders immediately and can loop forever. | error |
| `react/no-props-mutation` | writing to `props.x` or calling a mutating array method on `props.x` | React and the React Compiler assume props are immutable; mutating them breaks memoization and produces inconsistent renders. | error |
| `react/no-inline-object-prop` | an object literal passed as a prop to a custom component | A fresh object is a new reference every render, so a memoized child re-renders anyway. | warn |
| `react/no-inline-array-prop` | an array literal passed as a prop to a custom component | Same as above for arrays. | warn |
| `react/no-inline-function-prop` | a function literal (arrow or `function`) passed as a prop to a custom component | Same as above for functions; wrap in `useCallback` or hoist. | warn |
| `react/no-jsx-as-prop` | a JSX element passed as a prop to a custom component | A JSX literal is a new element object every render. | warn |

All rules report a diagnostic only (category `plugin`); none apply an auto-fix, because the correct repair is
context-specific — the plugin flags the hazard and leaves the fix to you.

### no-use-effect

```tsx
// flagged
useEffect(() => { fetchData(id); }, [id]);

// safe — derive during render
const active = useMemo(() => items.filter((i) => i.active), [items]);
```

Every direct `useEffect(...)` call is flagged (severity `warn`). For a genuine mount-only effect, route it
through a dedicated wrapper (e.g. `useMountEffect`) and suppress the rule there once:

```tsx
// biome-ignore lint/plugin: useMountEffect implementation
useEffect(effect, []);
```

### no-nested-component-definitions

```tsx
// flagged — Child and Inline are recreated every render
function Parent() {
  function Child() { return <div />; }
  const Inline = () => <span />;
  return <div><Child /><Inline /></div>;
}

// safe — module scope
function Child() { return <div />; }
function Parent() { return <Child />; }
```

Matches a PascalCase function declaration nested in another component, and a PascalCase arrow (whose body
contains JSX) assigned to a `const` nested in another component. The ancestor match is made *strict* with a
`$outer <: not $decl` guard, because Biome's `within` is reflexive (a node is "within" itself) — without it,
every top-level component would match itself as its own parent.

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

Flags a `setX(...)` call (setter name matched as `set` + PascalCase) that sits directly in a component body.
The guards exclude the legitimate deferred cases: JSX event-handler values (`onClick={() => setX()}`),
callbacks passed to another call (`useEffect(() => setX())`, `addEventListener`, …), and inner handlers
assigned to a lowercase-named `const` (`const handler = () => setX()`).

### no-props-mutation

```tsx
props.count = 5;         // flagged
props.items.push(1);     // flagged (in-place array mutation)
const next = { ...props, count: 5 };   // safe — copy
```

Flags direct assignment to a `props.*` member and in-place array mutations (`push`, `pop`, `shift`,
`unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`) on a `props.*` member. This is a structural
subset of the React Compiler's immutability checks (see [Limitations](#limitations)).

### react-perf (inline props)

```tsx
// flagged — new reference every render, on a custom (PascalCase) component
<Widget style={{ color: "red" }} items={[1, 2, 3]} onSelect={() => go()} icon={<Icon />} />;

// safe — host element, cannot be memoized, so not flagged
<div style={{ color: "red" }} onClick={() => go()} />;

// safe — stable references
<Widget style={STABLE_STYLE} onSelect={handleSelect} />;
```

The four inline-prop rules fire only when the enclosing element is a **custom (PascalCase) component** —
`<Widget />`, not `<div />`. Host elements can't be memoized, so flagging inline props there would be noise.
This is a deliberate narrowing of `eslint-plugin-react-perf`, which flags all elements.

## Limitations

The plugin matches **structure, not types or scopes**, so a few of the requested ESLint rules port only
partially or not at all:

- **`react/no-unused-prop-types`** is **not** implemented. Detecting an unused prop type requires resolving a
  component's `Props` type/interface and tracking every read of each member across the component's scope —
  cross-file type and scope analysis that GritQL cannot express. Biome's built-in
  [`noUnusedVariables`](https://biomejs.dev/linter/rules/no-unused-variables/) and TypeScript's
  `noUnusedParameters` cover adjacent ground.
- **`react-compiler`** cannot be ported wholesale — the compiler performs whole-function dataflow analysis to
  prove a component follows the Rules of React. `no-props-mutation` implements the most common structurally
  detectable violation (mutating props); it does not attempt the full analysis. Run the React Compiler itself
  for complete coverage.
- **Name-based matching**: rules key off identifier names (`useEffect`, `set*`, PascalCase). An unrelated
  `useEffect`-named function, a non-setter `setSomething`, or a PascalCase non-component will also match. GritQL
  plugins can't yet take configuration, so the match is intentionally broad — scope the plugin with Biome's
  `includes`/`overrides` if false positives are a problem.
- **`no-set-state-in-render`** is component-scoped (PascalCase functions/arrows). A setter called during a
  custom hook's render (`useThing`) is not flagged, and an inner handler assigned to a lowercase `const` is
  treated as deferred. `no-props-mutation` only tracks the literal identifier `props` (not a destructured
  `{ config }`).

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

Requires Biome **2.0+** (GritQL plugins landed in v2.0). Developed and tested against Biome 2.5.

> Using it directly from this repo instead? Set `"plugins": ["./react.grit"]` and point the path at the
> checked-out file.

## Try it

```sh
npm install
npx @biomejs/biome lint example.tsx
```

## Tests

Snapshot tests live in [tests/](tests/). Each case is a pair: `tests/fixtures/<name>.tsx` (the source to lint)
and `<name>.expected.json` (the diagnostics it should produce, as an order-independent array of
`{ "line": <number>, "rule": "<slug>" }`). The runner ([scripts/run-tests.mjs](scripts/run-tests.mjs)) runs
`biome lint --reporter=json` on each fixture with only the plugin enabled and compares the extracted
diagnostics against the expectation.

```sh
npm test
```

Each rule has a flagged fixture and a safe counterpart: `useEffect` vs. `useMemo`; nested vs. module-scope
components; setState in render vs. in a handler/effect; props mutation vs. spread copy; and inline
object/array/function/JSX props on a custom component vs. the same on a host element and with stable references.

## How it works

The plugin is one Biome GritQL file, [react.grit](react.grit). A few implementation notes worth knowing if you
extend it:

- **Biome's GritQL regex is fully anchored** — `r"set[A-Z][a-zA-Z0-9_]*"` must match the *entire* identifier,
  not a prefix. `r"^set[A-Z]"` would only match four-character names like `setN`.
- **`within` is reflexive** — a node matches itself. The nested-component rule adds `$outer <: not $decl` to
  force a strict ancestor.
- **Metavariable names must not start with `$__`** — a double underscore collides with GritQL's `$_` anonymous
  wildcard and fails to compile. This plugin uses a `$p`-prefix (`$pcomp`, `$po`) for internal names.
- **Host vs. custom elements** — the react-perf rules match on `JsxSelfClosingElement` / `JsxOpeningElement`
  ancestors whose `name` is PascalCase, so `<div>` is left alone.

## Releasing

Versions and the changelog are managed with [Changesets](https://github.com/changesets/changesets).

1. Add a changeset describing a change: `npx changeset`.
2. Commit the changeset to your branch.
3. On merge to `main`, the [Release workflow](.github/workflows/release.yml) opens a "Version Packages" pull
   request that bumps the version and updates `CHANGELOG.md`.
4. Merge that PR and the workflow publishes the new version to npm.

The workflow needs an `NPM_TOKEN` secret in the repo. CI runs the test suite on every push and pull request
([.github/workflows/ci.yml](.github/workflows/ci.yml)).

---

Inspired by [`biome-plugin-no-use-effect`](https://github.com/victorpatru/biome-plugin-no-use-effect),
[`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react),
[`eslint-plugin-react-perf`](https://github.com/cvazac/eslint-plugin-react-perf), and the
[React Compiler](https://react.dev/learn/react-compiler).
