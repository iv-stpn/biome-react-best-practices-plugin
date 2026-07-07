function Comp(props) {
  props.count = 5;
  props.items.push(1);
  return <div>{props.count}</div>;
}
