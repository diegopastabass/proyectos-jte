import { useEffect, useState } from "react";
import axios from "axios";
import { type User, type SessionData } from "../types";
import Navbar from "./Navbar";

import { PDFMeasurementReport } from "./PDFMeasurementReport";
import saveAs from "file-saver";
import api from "../api";

interface Props {
  user: User;
  onLogout: () => void;
  onNewSession: () => void;
  onGoToExport: () => void;
  onCompleteSession: (id: string) => void;
}

export default function Home({
  user,
  onLogout,
  onNewSession,
  onGoToExport,
  onCompleteSession,
}: Props) {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem("user_token");
      const res = await axios.get(
        "https://app.jteanalytics.cl/zuniga-mediciones/sessions/app/",
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
    setDownloadingId(id);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const res = await api.get(`sessions/app/report/${id}`);

      const reportData = res.data;

      const blob = await pdf(
        <PDFMeasurementReport data={reportData} />,
      ).toBlob();

      saveAs(blob, `Reporte_Sesion_${id}.pdf`);
    } catch (error) {
      console.error("Error generando reporte:", error);
      alert("Error al generar el reporte. Intente nuevamente.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <Navbar user={user} onLogout={onLogout} />
      <div className="container py-4">
        <div>
          <div className="d-flex align-items-center mb-3">
            <h4 className="mb-0">Historial de Mediciones</h4>

            <div className="ms-auto d-flex gap-2">
              {user.type === "0" && (
                <button className="btn btn-outline-dark" onClick={onGoToExport}>
                  <i className="bi bi-bar-chart-line me-2"></i>
                  Reportes Acumulados
                </button>
              )}

              <button className="btn btn-success" onClick={onNewSession}>
                <i className="bi bi-plus-circle me-2"></i>
                Nueva Sesión
              </button>
            </div>
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
                    <th>Estado</th>
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
                      <td>{session.user.name}</td>
                      <td>{session.measures_number}</td>
                      <td>
                        {session.state === "1" ? (
                          <span className="badge bg-success">
                            <i className="bi bi-check-circle-fill me-1"></i>
                            Completa
                          </span>
                        ) : (
                          <span className="badge bg-warning text-dark">
                            <i className="bi bi-hourglass-split me-1"></i>
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="d-flex gap-2 flex-wrap">
                        {session.state === "0" && (
                          <button
                            className="btn btn-sm btn-warning fw-bold"
                            onClick={() => onCompleteSession(session.id)}
                          >
                            <i className="bi bi-plus-circle me-1"></i>
                            Completar
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleDownload(session.id)}
                          disabled={downloadingId === session.id || session.state === "0"}
                          title={session.state === "0" ? "La sesión debe completarse antes de descargar el informe" : "Descargar informe PDF"}
                        >
                          {downloadingId === session.id ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2"></span>
                              Generando...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-file-earmark-pdf me-1"></i>
                              Informe
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-muted">
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
