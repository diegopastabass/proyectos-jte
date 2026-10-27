import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Electrico from "./pages/Electrico";

function App() {
  return (
    <Routes>
      <Route path="/ranguil/" element={<Home />} />
      <Route path="/ranguil/electrico" element={<Electrico />} />
    </Routes>
  );
}

export default App;
