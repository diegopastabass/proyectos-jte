import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import MaintenanceForm from "./pages/NewMaintenance";
import ResumeMaintenance from "./pages/ResumeMaintenance";

function App() {
  return (
    <Routes>
      <Route path="/mantenimiento/" element={<Login />} />
      <Route path="/mantenimiento/home" element={<Home />} />
      <Route path="/mantenimiento/new" element={<MaintenanceForm />} />
      <Route
        path="/mantenimiento/resume/:maintenanceId"
        element={<ResumeMaintenance />}
      />
    </Routes>
  );
}

export default App;
