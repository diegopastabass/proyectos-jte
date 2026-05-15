import { useState, useEffect } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import Home from "./components/Home";
import CreateSession from "./components/CreateSession";
import UpdateSession from "./components/UpdateSession";
import ExportReports from "./components/ExportReports";
import { type User, type SessionData } from "./types";

function App() {
  const [view, setView] = useState<
    "login" | "register" | "home" | "create" | "update" | "export"
  >("login");
  const [user, setUser] = useState<User | null>(null);
  const [pendingSession, setPendingSession] = useState<SessionData | null>(
    null,
  );

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
          onNewSession={() => setView("create")}
          onGoToExport={() => setView("export")}
          onCompleteSession={(session) => {
            setPendingSession(session);
            setView("update");
          }}
        />
      )}

      {user && view === "create" && (
        <CreateSession user={user} onBack={() => setView("home")} />
      )}

      {user && view === "update" && pendingSession && (
        <UpdateSession
          user={user}
          sessionId={pendingSession.id}
          sessionData={pendingSession}
          onBack={() => {
            setPendingSession(null);
            setView("home");
          }}
        />
      )}

      {user && view === "export" && (
        <ExportReports
          user={user}
          onLogout={handleLogout}
          onBack={() => setView("home")}
        />
      )}
    </div>
  );
}

export default App;
