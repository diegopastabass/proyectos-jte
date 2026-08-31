import { useState, useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Home from "./components/Home";
import VehicleAdmin from "./components/VehicleAdmin";
import type { User } from "./types";

function App() {
  const [view, setView] = useState<"login" | "register" | "home" | "vehicles">("login");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Restaurar sesión si existe
    const storedUser = localStorage.getItem("user_data");
    const storedToken = localStorage.getItem("user_token");
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setView("home");
    }
  }, []);

  const handleLogin = (userData: User) => {
    localStorage.setItem("user_token", userData.token || "");
    localStorage.setItem("user_data", JSON.stringify(userData));
    setUser(userData);
    setView("home");
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setView("login");
  };

  return (
    <div>
      {view === "login" && (
        <Login
          onLogin={handleLogin}
          onSwitchToRegister={() => setView("register")}
        />
      )}

      {view === "register" && (
        <Register
          onRegisterSuccess={() => setView("login")}
          onSwitchToLogin={() => setView("login")}
        />
      )}

      {user && view === "home" && (
        <Home
          user={user}
          onLogout={handleLogout}
          onGoToVehicles={
            user.rol === "admin" ? () => setView("vehicles") : undefined
          }
        />
      )}

      {user && view === "vehicles" && user.rol === "admin" && (
        <VehicleAdmin
          user={user}
          onLogout={handleLogout}
          onGoToHome={() => setView("home")}
        />
      )}
    </div>
  );
}

export default App;
