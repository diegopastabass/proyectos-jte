import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.tsx";

function App() {
  return (
    <Routes>
      <Route path="/viveros/" element={<Home />} />
    </Routes>
  );
}

export default App;
