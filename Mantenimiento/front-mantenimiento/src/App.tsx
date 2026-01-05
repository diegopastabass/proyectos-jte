import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";

function App() {
  return (
    <Routes>
      <Route path="/mantenimiento/" element={<Home />} />
    </Routes>
  );
}

export default App;
