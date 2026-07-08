import { useState } from "react";

// arrow-function component: setter in render is flagged
const Arrow = () => {
  const [n, setN] = useState(0);
  setN(1);
  return <div>{n}</div>;
};

// function-expression component: setter in render is flagged
const FnExpr = function () {
  const [k, setK] = useState(0);
  setK(1);
  return <div>{k}</div>;
};

// custom hook: a setter directly in the hook body is render-phase too
function useCounter() {
  const [c, setC] = useState(0);
  setC(1);
  return c;
}
