function Comp(props) {
  const count = props.count + 1;
  const items = [...props.items, 1];
  return (
    <div>
      {count}
      {items.length}
    </div>
  );
}
