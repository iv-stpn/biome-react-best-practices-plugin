// Run `npx @biomejs/biome lint example.tsx` to see the plugin flag each hazard.
// (Illustrative snippets; `useEffect`, `useState`, `Widget`, `Icon`, etc. are
// assumed imported. The safe forms at the bottom are left alone.)

import { useEffect, useState } from "react";

// no-use-effect — prefer derived state / handlers / a data library
function Fetcher({ id }) {
  useEffect(() => {
    fetchData(id);
  }, [id]);
  return <div />;
}

// no-nested-component-definitions — Child is recreated every render
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

// no-set-state-in-render — setter called synchronously during render
function Counter() {
  const [count, setCount] = useState(0);
  setCount(1);
  return <div>{count}</div>;
}

// no-props-mutation — props are immutable
function Mutator(props) {
  props.count = 5;
  props.items.push(1);
  return <div>{props.count}</div>;
}

// react-perf — inline props defeat memoization of a custom (PascalCase) component
function View() {
  return (
    <Widget
      style={{ color: "red" }}
      items={[1, 2, 3]}
      icon={<Icon />}
    />
  );
}

// --- safe forms below: the plugin leaves these alone ---

// derive during render instead of an effect
function DerivedView({ items }) {
  const active = items.filter((i) => i.active);
  return <div>{active.length}</div>;
}

// component defined at module scope
function StableChild() {
  return <div />;
}
function GoodParent() {
  return <StableChild />;
}

// setter called from a handler, not during render
function GoodCounter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}

// host element (lowercase) — inline props are not flagged (can't be memoized)
function HostView() {
  return <div style={{ color: "red" }} onClick={() => go()} />;
}
