import { useState } from "react";

function Comp() {
  const [count, setCount] = useState(0);
  // named function declaration — a handler, not render
  function handleClick() {
    setCount(count + 1);
  }
  // nested arrow assigned to a lowercase const
  const reset = () => setCount(0);
  return (
    <div>
      <button onClick={handleClick}>inc</button>
      <button onClick={reset}>reset</button>
    </div>
  );
}

// a state setter inside a nested function of a custom hook is also deferred
function useCounter() {
  const [count, setCount] = useState(0);
  function increment() {
    setCount(count + 1);
  }
  return { count, increment };
}
