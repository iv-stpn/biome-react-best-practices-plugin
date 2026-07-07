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

const App = () => {
  const Nested = () => <p>hi</p>;
  return <Nested />;
};
