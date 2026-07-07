import { useEffect } from "react";

function Comp() {
  useEffect(() => {
    fetchData();
  }, [id]);
  return <div />;
}
