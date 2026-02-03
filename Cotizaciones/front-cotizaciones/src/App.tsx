import { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import CreateQuote from "./components/CreateQuote";
import { type User } from "./types";

function App() {
  const [view, setView] = useState<
    "login" | "register" | "dashboard" | "create"
  >("login");
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<User | null>(
    localStorage.getItem("user")
      ? JSON.parse(localStorage.getItem("user")!)
      : null,
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
          <nav className="navbar navbar-dark bg-dark px-3 mb-4">
            <div className="d-flex align-items-center">
              <span className="navbar-brand mb-0 h1 me-3">
                <img src="./assets/logo_jt2.png" alt="" />
              </span>
              <button
                className="btn btn-outline-light btn-sm"
                onClick={handleLogout}
              >
                Salir
              </button>
            </div>
            <span className="navbar-text text-white">
              Hola, {user.fullName}
            </span>
          </nav>

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
