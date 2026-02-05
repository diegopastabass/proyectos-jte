import { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import CreateQuote from "./components/CreateQuote";
import { type User } from "./types";
import Navbar from "./components/Navbar";

function App() {
  const storedToken = localStorage.getItem("token");
  const storedUser = localStorage.getItem("user");
  const [view, setView] = useState<
    "login" | "register" | "dashboard" | "create"
  >(storedToken ? "dashboard" : "login");

  const [token, setToken] = useState<string | null>(storedToken);

  const [user, setUser] = useState<User | null>(
    storedUser ? JSON.parse(storedUser) : null,
  );

  const handleLoginSuccess = (tk: string, usr: User) => {
    setToken(tk);
    setUser(usr);
    localStorage.setItem("token", tk);
    localStorage.setItem("user", JSON.stringify(usr));
    setView("dashboard");
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setView("login");
  };

  return (
    <div className="container-fluid p-0">
      {view === "login" && (
        <Login
          onLogin={handleLoginSuccess}
          onNavigate={() => setView("register")}
        />
      )}

      {view === "register" && <Register onNavigate={() => setView("login")} />}

      {(view === "dashboard" || view === "create") && user && (
        <>
          {/* Navbar */}
          <Navbar user={user} onLogout={handleLogout} className="mb-4" />

          <div className="container">
            {view === "dashboard" && (
              <Dashboard
                token={token!}
                onCreateClick={() => setView("create")}
              />
            )}

            {view === "create" && (
              <CreateQuote
                token={token!}
                onCancel={() => setView("dashboard")}
                onSuccess={() => setView("dashboard")}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
