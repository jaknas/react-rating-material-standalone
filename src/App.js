import "./styles.css";

import MuiRating from "./MuiRating";

export default function App() {
  return (
    <div className="App">
      <h1>Hello CodeSandbox</h1>
      <h2>Edit to see some magic happen!</h2>
      <div style={{ width: "200px" }}>
        <MuiRating />
      </div>
    </div>
  );
}
