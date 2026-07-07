import { useEffect, useState } from "react";

function Comp() {
  const [count, setCount] = useState(0);
  const handler = () => setCount(count + 1);
  useEffect(() => {
    setCount(0);
  }, []);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
