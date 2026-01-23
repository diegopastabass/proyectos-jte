import { useEffect, useState } from "react";
import axios from "axios";
import { type User, type SessionData } from "../types";
import Navbar from "./Navbar";

interface Props {
  user: User;
  onLogout: () => void;
  onNewSession: () => void;
}

export default function Home({ user, onLogout, onNewSession }: Props) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem("user_token");
      const res = await axios.get(
        "https://app.jteanalytics.cl/ranguil-mediciones/sessions/app/",
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      let data = res.data;

      if (user.type === "1") {
        data = data.filter((s: SessionData) => s.user.email === user.email);
      }

      setSessions(data);
    } catch (error) {
      console.error("Error cargando sesiones");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const token = localStorage.getItem("user_token");

      // Hacemos una petición BLOB para descargar el archivo
      const res = await axios.get(
        `https://app.jteanalytics.cl/ranguil-mediciones/sessions/app/report/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob", // Importante para recibir binarios
        },
      );

      // Crear URL temporal para descargar
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Reporte_Sesion_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link); // Limpieza
    } catch (error) {
      console.error("Error descargando reporte", error);
      alert("No se pudo generar el reporte. Intente nuevamente.");
    }
  };

  return (
    <>
      {/* Navbar */}
      <Navbar user={user} onLogout={onLogout} />
      <div className="container py-4">
        <div>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h4>Historial de Mediciones</h4>
            <button
              className="btn btn-success bi-plus-circle"
              onClick={onNewSession}
            ></button>
          </div>

          {loading ? (
            <div className="text-center mt-5">
              <div className="spinner-border text-primary"></div>
            </div>
          ) : (
            <div className="table-responsive bg-white shadow-sm rounded">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Responsable</th>
                    <th>Mediciones</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id}>
                      <td>#{session.id}</td>
                      <td>
                        {new Date(session.createdAt).toLocaleDateString()}{" "}
                        {new Date(session.createdAt).toLocaleTimeString()}
                      </td>
                      <td>{session.user.full_name}</td>
                      <td>{session.measures_number}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleDownload(session.id)}
                        >
                          <i className="bi bi-file-earmark-arrow-down"></i>{" "}
                          Informe
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-muted">
                        No hay sesiones registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
