import React, { useState, useEffect, useRef } from "react";
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
  const [selectedVehicle, setSelectedVehicleState] = useState<Vehicle | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem("selected_vehicle") || "null");
    } catch {
      return null;
    }
  });
  const [selectedChecklist, setSelectedChecklistState] = useState<any>(null);
  const toastId = useRef(0);

  // El vehículo y el checklist elegidos sobreviven a una recarga de la pestaña
  const setSelectedVehicle = (v: Vehicle | null) => {
    setSelectedVehicleState(v);
    try {
      if (v) sessionStorage.setItem("selected_vehicle", JSON.stringify(v));
      else sessionStorage.removeItem("selected_vehicle");
    } catch { /* sin storage */ }
  };
  const setSelectedChecklist = (c: any) => {
    setSelectedChecklistState(c);
    try {
      if (c?.id) sessionStorage.setItem("selected_checklist_id", String(c.id));
    } catch { /* sin storage */ }
  };

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
      // El token se lee en cada cambio: el valor del montaje queda viejo tras iniciar sesión
      const token = localStorage.getItem("jwt_token");
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
        if (token && (hash === "login" || hash === "register")) {
          return; // sesión activa: un hash viejo de login no debe mostrar el login
        }
        if (!token && hash !== "login" && hash !== "register") {
          setView("login");
        } else {
          setView(hash || "login");
        }
      }
    };
    window.addEventListener("hashchange", handleHash);
    handleHash(); // respeta el hash al abrir/recargar (ej. #checklist-detail)
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  // Aviso cuando falten pocos minutos para que venza la sesión (el JWT dura 8 h)
  useEffect(() => {
    if (!user) return;
    let warned = false;
    const check = () => {
      try {
        const token = localStorage.getItem("jwt_token");
        if (!token) return;
        const exp = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000;
        const left = exp - Date.now();
        if (left < 15 * 60 * 1000 && !warned) {
          warned = true;
          addToast(`Su sesión vence en ${Math.max(1, Math.round(left / 60000))} min. Termine y guarde su checklist, luego vuelva a iniciar sesión.`, "warning");
        }
      } catch { /* token ilegible */ }
    };
    check();
    const t = setInterval(check, 60 * 1000);
    return () => clearInterval(t);
  }, [user]);

  const changeView = (newView: ViewState) => {
    window.location.hash = newView;
    setView(newView);
  };

  const addToast = (
    message: string,
    type: "success" | "error" | "warning" | "info",
  ) => {
    const id = ++toastId.current;
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
    sessionStorage.removeItem("selected_vehicle");
    sessionStorage.removeItem("selected_checklist_id");
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
            <ChecklistList user={user} setViewState={changeView} addToast={addToast} onSelectChecklist={setSelectedChecklist} />
          </div>
        )}
        {view === "checklist-detail" && user && (
          <ChecklistDetail setViewState={changeView} checklist={selectedChecklist} onLoaded={setSelectedChecklist} />
        )}
      </main>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </>
  );
};

export default App;
