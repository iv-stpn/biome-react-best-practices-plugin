function Child() {
  return <div />;
}

const Inline = () => <span />;

function Parent() {
  const value = computeValue();
  const handler = () => doThing();
  return (
    <div>
      <Child />
      <Inline />
    </div>
  );
}
