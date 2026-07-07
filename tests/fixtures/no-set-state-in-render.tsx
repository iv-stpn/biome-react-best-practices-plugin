import { useState } from "react";

function Comp() {
  const [count, setCount] = useState(0);
  setCount(1);
  if (count > 0) {
    setCount(2);
  }
  return <div>{count}</div>;
}

const Arrow = () => {
  const [name, setName] = useState("");
  setName("x");
  return <div>{name}</div>;
};
