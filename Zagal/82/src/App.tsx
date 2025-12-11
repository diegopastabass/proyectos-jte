import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";

function App() {
  return (
    <Routes>
      <Route path="/zagal/82/" element={<Home />} />
    </Routes>
  );
}

export default App;
