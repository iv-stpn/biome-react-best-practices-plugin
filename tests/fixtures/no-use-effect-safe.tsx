import { useMemo } from "react";

function Comp({ items }) {
  const active = useMemo(() => items.filter((i) => i.active), [items]);
  return <div>{active.length}</div>;
}
