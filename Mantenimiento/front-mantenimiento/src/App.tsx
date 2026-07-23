import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Login from "./components/Login";
import Register from "./components/Register";
import ReportList from "./components/ReportList";
import ReportForm from "./components/ReportForm";
import { type User, type ReportData } from "./types";
import api from "./api";

type ViewState = "login" | "register" | "list" | "form";

function App() {
  const [view, setView] = useState<ViewState>("login");
  const [user, setUser] = useState<User | null>(null);
  // Estado para saber qué ID estamos editando (null = creando nuevo)
  const [editingId, setEditingId] = useState<string | null>(null);
  // Estado para datos de clonado (null = no hay clon activo)
  const [cloneData, setCloneData] = useState<ReportData | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    if (storedUser && token) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      if (parsedUser.role === "1") {
        setView("list");
      } else {
        setView("form");
      }
    }
  }, []);

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    if (userData.role === "1") {
      setView("list");
    } else {
      setView("form");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setView("login");
  };

  // Función para iniciar edición desde la lista
  const handleEditReport = (id: string) => {
    setCloneData(null);
    setEditingId(id);
    setView("form");
  };

  const handleCreateNew = () => {
    setCloneData(null);
    setEditingId(null);
    setView("form");
  };

  // Función para clonar un informe: carga sus datos, limpia firmas y abre el editor como nuevo
  const handleCloneReport = async (id: string) => {
    try {
      const res = await api.get(`/app/reports/${id}`);
      if (res.data && res.data.data) {
        const sourceData: ReportData = res.data.data;
        // Limpiar datos que NO deben copiarse al clon
        const cloned: ReportData = {
          ...sourceData,
          techSignature: "",
          clientSignature: "",
          clientSigner: "",
          isApproved: false,
          capturedImages: [], // El clon empieza sin fotos del trabajo anterior
          ticket: { ...sourceData.ticket, number: "" }, // El backend asignará nuevo OT
        };
        setCloneData(cloned);
        setEditingId(null); // Sin ID = se creará como nuevo informe
        setView("form");
      }
    } catch (error) {
      alert("Error al cargar el informe para clonar. Verifique la conexión.");
    }
  };

  const renderContent = () => {
    switch (view) {
      case "login":
        return (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onGoToRegister={() => setView("register")}
          />
        );

      case "register":
        return <Register onGoToLogin={() => setView("login")} />;

      case "list":
        if (user?.role !== "1") return <ReportForm isAdmin={false} />;
        return (
          <ReportList
            onCreateNew={handleCreateNew}
            onEdit={handleEditReport}
            onClone={handleCloneReport}
          />
        );

      case "form":
        return (
          <ReportForm
            isAdmin={user?.role === "1"}
            reportId={editingId}
            cloneData={cloneData}
            onBack={() => {
              setCloneData(null);
              setView("list");
            }}
          />
        );

      default:
        return (
          <Login
            onLoginSuccess={handleLoginSuccess}
            onGoToRegister={() => setView("register")}
          />
        );
    }
  };

  return (
    <>
      {user && <Navbar user={user} onLogout={handleLogout} />}
      {renderContent()}
    </>
  );
}

export default App;
