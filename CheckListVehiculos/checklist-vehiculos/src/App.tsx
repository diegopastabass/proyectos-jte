import React, { useState, useEffect } from "react";
import { User, ViewState, ToastMessage, Vehicle } from "./types";
import Login from "./components/Login";
import Register from "./components/Register";
import Home from "./components/Home";
import ChecklistForm from "./components/ChecklistForm";
import ChecklistDetail from "./components/ChecklistDetail";
import Navbar from "./components/Navbar";
import ToastContainer from "./components/ToastContainer";
import ChecklistList from "./components/ChecklistList";
import { syncPendingErrors } from "./errorLogger";

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>("login");
  const [user, setUser] = useState<User | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);

  useEffect(() => {
    // Check auth from localStorage
    const token = localStorage.getItem("jwt_token");
    const storedUser = localStorage.getItem("user_data");
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setView("home");
        syncPendingErrors(); // Sync pending errors on load
      } catch (e) {
        localStorage.removeItem("jwt_token");
        localStorage.removeItem("user_data");
      }
    } else if (token) {
      localStorage.removeItem("jwt_token");
    }

    // Hash routing for simple browser back/forward
    const handleHash = () => {
      const hash = window.location.hash.replace("#", "") as ViewState;
      if (
        [
          "login",
          "register",
          "home",
          "checklist-form",
          "checklist-list",
          "checklist-detail",
        ].includes(hash)
      ) {
        if (!token && hash !== "login" && hash !== "register") {
          setView("login");
        } else {
          setView(hash || "login");
        }
      }
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const changeView = (newView: ViewState) => {
    window.location.hash = newView;
    setView(newView);
  };

  const addToast = (
    message: string,
    type: "success" | "error" | "warning" | "info",
  ) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoginSuccess = (token: string, userData: User) => {
    localStorage.setItem("jwt_token", token);
    localStorage.setItem("user_data", JSON.stringify(userData));
    setUser(userData);
    changeView("home");
    addToast(`Bienvenido, ${userData.name}`, "success");
    syncPendingErrors(); // Sync pending errors after login
  };

  const handleLogout = () => {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_data");
    setUser(null);
    changeView("login");
  };


  return (
    <>
      {user && view !== "login" && view !== "register" && (
        <Navbar user={user} onLogout={handleLogout} setViewState={changeView} currentView={view} />
      )}

      <main>
        {view === "login" && (
          <Login
            setViewState={changeView}
            onLoginSuccess={handleLoginSuccess}
            addToast={addToast}
          />
        )}
        {view === "register" && (
          <Register setViewState={changeView} addToast={addToast} />
        )}
        {view === "home" && user && (
          <Home
            user={user}
            setViewState={changeView}
            setSelectedVehicle={setSelectedVehicle}
            addToast={addToast}
          />
        )}
        {view === "checklist-form" && user && (
          <ChecklistForm
            vehicle={selectedVehicle}
            setViewState={changeView}
            addToast={addToast}
          />
        )}
        {view === "checklist-list" && user && (
          <div className="container mt-4">
            <ChecklistList setViewState={changeView} addToast={addToast} onSelectChecklist={setSelectedChecklist} />
          </div>
        )}
        {view === "checklist-detail" && user && (
          <ChecklistDetail setViewState={changeView} checklist={selectedChecklist} />
        )}
      </main>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
};

export default App;
