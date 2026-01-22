import { useState, useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Home from "./components/Home";
import CreateSession from "./components/CreateSession";
import { type User } from "./types";

function App() {
  const [view, setView] = useState<"login" | "register" | "home" | "create">(
    "login",
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user_data");
    if (storedUser) {
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
    <div
      className="container-fluid"
      style={{ minHeight: "100vh", backgroundColor: "#f8f9fa" }}
    >
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
          onNewSession={() => setView("create")}
        />
      )}

      {user && view === "create" && (
        <CreateSession user={user} onBack={() => setView("home")} />
      )}
    </div>
  );
}

export default App;
