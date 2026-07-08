import { useCallback } from "react";

// Already wrapped — the RHS is a call, not a bare function.
function View() {
  const handleClick = useCallback(() => go(), []);
  return <button onClick={handleClick} />;
}

// Nested handlers: the function's nearest enclosing function is NOT the
// component, so it is left alone (declared inside another handler / callback).
function Panel() {
  const onOuter = useCallback(() => {
    const onInner = () => step();
    function helperInner() {
      return step();
    }
    return onInner() + helperInner();
  }, []);
  return <div onClick={onOuter} />;
}

// Inline handler passed straight to JSX — not a top-level declaration.
function Toolbar() {
  return <button onClick={() => act()} />;
}

// Module-scope function — not inside any component/hook.
function helper() {
  return 1;
}
