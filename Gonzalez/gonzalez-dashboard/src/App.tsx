import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";

function App() {
  return (
    <Routes>
      <Route path="/gonzalez/" element={<Home />} />
    </Routes>
  );
}

export default App;
