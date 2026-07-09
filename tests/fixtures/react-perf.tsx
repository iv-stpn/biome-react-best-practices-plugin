function View() {
  return (
    <div>
      <Widget style={{ color: "red" }} />
      <Widget items={[1, 2, 3]} />
      <Widget icon={<Icon />} />
    </div>
  );
}
