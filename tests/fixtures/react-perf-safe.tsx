import { useCallback, useMemo } from "react";

const STYLE = { color: "red" };

function View({ items }) {
  const memoItems = useMemo(() => items.map((i) => i.id), [items]);
  const onSelect = useCallback(() => go(), []);
  return (
    <div style={{ color: "blue" }}>
      <span onClick={() => host()} />
      <Widget style={STYLE} items={memoItems} onSelect={onSelect} />
    </div>
  );
}
