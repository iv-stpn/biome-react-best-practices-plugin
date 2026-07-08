function View() {
  const handleClick = () => go();
  const handleSave = function () {
    save();
  };
  function handleReset() {
    reset();
  }
  return <button onClick={handleClick}>{handleReset()}</button>;
}

const Panel = () => {
  const onToggle = () => toggle();
  return <div onClick={onToggle} />;
};

function useThing() {
  const compute = () => 1;
  return compute;
}
