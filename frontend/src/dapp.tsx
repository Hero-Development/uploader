
import { useState } from 'preact/hooks'

const Dapp = () => {
  const [count, setCount] = useState(0)

  const render = () => {
    return (
      <>
        <p>Body</p>
      </>
    );
  };

  return render();
};

export default Dapp;
