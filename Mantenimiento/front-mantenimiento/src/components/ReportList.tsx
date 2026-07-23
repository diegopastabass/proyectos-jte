import { useEffect, useState, useMemo } from "react";
import api from "../api";
import { type ReportSummary, type ReportData } from "../types";
import { pdf } from "@react-pdf/renderer";
import { PDFReport } from "./PDFReport";
import { saveAs } from "file-saver";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortField = "createdAt" | "ticketNumber" | "clientName";
type SortDir = "asc" | "desc";

interface Props {
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  onClone: (id: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normaliza un string para comparación: minúsculas + sin tildes.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Calcula un score de relevancia del informe frente al query.
 * Retorna un número >= 0; mayor = más relevante.
 * - Coincidencia exacta: +10
 * - Substring: +5
 * - Cada carácter en común (por posición): +1
 */
function relevanceScore(report: ReportSummary, query: string): number {
  if (!query) return 1; // sin query → todos pasan con score neutro

  const q = normalize(query);

  const fields = [
    normalize(String(report.ticketNumber)),
    normalize(report.clientName ?? ""),
    normalize(new Date(report.createdAt).toLocaleDateString("es-CL")),
    normalize(new Date(report.createdAt).toISOString().slice(0, 10)),
    normalize(report.status ?? ""),
  ];

  let score = 0;

  for (const field of fields) {
    if (field === q) {
      score += 10;
    } else if (field.includes(q)) {
      score += 5;
    } else {
      // Contar caracteres del query que aparecen en el campo
      let matches = 0;
      for (const ch of q) {
        if (field.includes(ch)) matches++;
      }
      if (matches > 0) {
        score += matches / q.length; // fracción de coincidencia
      }
    }
  }

  return score;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportList({ onCreateNew, onEdit, onClone }: Props) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Búsqueda
  const [query, setQuery] = useState("");

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Modal eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<ReportSummary | null>(null);
  const [deleteCheck, setDeleteCheck] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState("");

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get("/app/reports/");
      setReports(res.data);
    } catch (error) {
      console.error("Error fetching reports", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Filtrado + ordenamiento (client-side) ──────────────────────────────────

  const displayedReports = useMemo(() => {
    const trimmed = query.trim();

    // 1. Filtrar por relevancia (si hay query)
    let filtered: ReportSummary[];
    if (trimmed) {
      const scored = reports
        .map((r) => ({ report: r, score: relevanceScore(r, trimmed) }))
        .filter(({ score }) => score > 0);

      // Ordenar primero por score descendente, luego por el campo elegido
      scored.sort((a, b) => b.score - a.score);
      filtered = scored.map(({ report }) => report);
    } else {
      filtered = [...reports];
    }

    // 2. Ordenar
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "createdAt":
          cmp =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "ticketNumber":
          cmp = Number(a.ticketNumber) - Number(b.ticketNumber);
          break;
        case "clientName":
          cmp = (a.clientName ?? "").localeCompare(b.clientName ?? "", "es");
          break;
      }
      // Si hay query activo, respetar el orden de relevancia (no re-sortear)
      if (trimmed && sortField === "createdAt") return 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [reports, query, sortField, sortDir]);

  // ── Sorting UI ─────────────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field)
      return <i className="bi bi-arrow-down-up text-muted ms-1" style={{ fontSize: "0.75rem" }} />;
    return sortDir === "asc" ? (
      <i className="bi bi-arrow-up ms-1" style={{ fontSize: "0.75rem" }} />
    ) : (
      <i className="bi bi-arrow-down ms-1" style={{ fontSize: "0.75rem" }} />
    );
  };

  // ── Acciones ────────────────────────────────────────────────────────────────

  const handleDownload = async (id: string, ticketNumber: string) => {
    try {
      const res = await api.get(`/app/reports/${id}`);
      const fullData: ReportData = res.data.data;
      const blob = await pdf(<PDFReport data={fullData} />).toBlob();
      saveAs(blob, `OT-${ticketNumber}.pdf`);
    } catch {
      alert("Error al generar el PDF");
    }
  };

  const confirmDelete = (report: ReportSummary) => {
    setReportToDelete(report);
    setDeleteCheck(false);
    setDeleteNameInput("");
    setShowDeleteModal(true);
  };

  const executeDelete = async () => {
    if (!reportToDelete) return;
    try {
      await api.delete(`/app/reports/${reportToDelete.id}`);
      setReports((prev) => prev.filter((r) => r.id !== reportToDelete.id));
      setShowDeleteModal(false);
      setReportToDelete(null);
    } catch {
      alert("Error al eliminar el reporte");
    }
  };

  const canDelete =
    reportToDelete &&
    deleteCheck &&
    deleteNameInput.trim() === reportToDelete.clientName;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="container py-4">
      {/* ── CABECERA ─────────────────────────────────────────────────────────── */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="mb-0">Historial de Informes</h2>
        <button
          className="btn btn-primary rounded-circle shadow"
          onClick={onCreateNew}
          style={{ width: "50px", height: "50px" }}
          title="Nuevo Informe"
        >
          <i className="bi bi-plus-lg" style={{ fontSize: "1.2rem" }} />
        </button>
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ──────────────────────────────────────── */}
      <div className="card shadow-sm mb-4 border-0" style={{ borderRadius: "12px" }}>
        <div className="card-body p-3">
          {/* Buscador */}
          <div className="input-group mb-3">
            <span className="input-group-text bg-white border-end-0">
              <i className="bi bi-search text-muted" />
            </span>
            <input
              id="report-search"
              type="text"
              className="form-control border-start-0 ps-0"
              placeholder="Buscar por OT, cliente, fecha, estado…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {query && (
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={() => setQuery("")}
                title="Limpiar búsqueda"
              >
                <i className="bi bi-x" />
              </button>
            )}
          </div>

          {/* Controles de orden */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="text-muted small me-1">
              <i className="bi bi-funnel me-1" />
              Ordenar por:
            </span>

            <button
              id="sort-fecha"
              className={`btn btn-sm ${
                sortField === "createdAt"
                  ? "btn-primary"
                  : "btn-outline-secondary"
              }`}
              onClick={() => toggleSort("createdAt")}
            >
              Fecha {sortIcon("createdAt")}
            </button>

            <button
              id="sort-ot"
              className={`btn btn-sm ${
                sortField === "ticketNumber"
                  ? "btn-primary"
                  : "btn-outline-secondary"
              }`}
              onClick={() => toggleSort("ticketNumber")}
            >
              OT {sortIcon("ticketNumber")}
            </button>

            <button
              id="sort-cliente"
              className={`btn btn-sm ${
                sortField === "clientName"
                  ? "btn-primary"
                  : "btn-outline-secondary"
              }`}
              onClick={() => toggleSort("clientName")}
            >
              Cliente {sortIcon("clientName")}
            </button>

            {/* Contador de resultados */}
            <span className="ms-auto text-muted small">
              {displayedReports.length === reports.length
                ? `${reports.length} informe${reports.length !== 1 ? "s" : ""}`
                : `${displayedReports.length} de ${reports.length} informe${reports.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── LISTADO ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mt-2">Cargando informes…</p>
        </div>
      ) : displayedReports.length === 0 ? (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-inbox fs-1 d-block mb-2" />
          {query
            ? "No se encontraron informes que coincidan con la búsqueda."
            : "No hay informes registrados."}
        </div>
      ) : (
        <div className="list-group shadow-sm">
          {displayedReports.map((report) => (
            <div
              key={report.id}
              className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            >
              <div>
                <h6 className="mb-1 fw-bold">
                  OT-{report.ticketNumber} |{" "}
                  <HighlightText text={report.clientName ?? ""} query={query} />
                </h6>
                <small className="text-muted">
                  Fecha:{" "}
                  <HighlightText
                    text={new Date(report.createdAt).toLocaleDateString("es-CL")}
                    query={query}
                  />{" "}
                  | Estado: {report.status}
                </small>
              </div>
              <div className="btn-group">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  title="Descargar PDF"
                  onClick={() =>
                    handleDownload(report.id, String(report.ticketNumber))
                  }
                >
                  <i className="bi bi-download" />
                </button>
                <button
                  className="btn btn-outline-success btn-sm"
                  title="Clonar Informe"
                  onClick={() => onClone(report.id)}
                >
                  <i className="bi bi-copy" />
                </button>
                <button
                  className="btn btn-outline-primary btn-sm"
                  title="Editar Informe"
                  onClick={() => onEdit(report.id)}
                >
                  <i className="bi bi-pencil" />
                </button>
                <button
                  className="btn btn-outline-danger btn-sm"
                  title="Eliminar Informe"
                  onClick={() => confirmDelete(report)}
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL DE ELIMINACIÓN ─────────────────────────────────────────────── */}
      {showDeleteModal && reportToDelete && (
        <div
          className="modal d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">
                  Eliminar Informe OT-{reportToDelete.ticketNumber}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowDeleteModal(false)}
                />
              </div>
              <div className="modal-body">
                <p className="text-danger fw-bold">Esta acción es irreversible.</p>

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="confirmCheck"
                    checked={deleteCheck}
                    onChange={(e) => setDeleteCheck(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="confirmCheck">
                    Estoy seguro de querer eliminar este informe. No se podrá
                    recuperar si así se desea.
                  </label>
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Escriba el nombre del cliente para confirmar:
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={`Escriba: ${reportToDelete.clientName}`}
                    value={deleteNameInput}
                    onChange={(e) => setDeleteNameInput(e.target.value)}
                  />
                  <div className="form-text">
                    Debe coincidir exactamente con:{" "}
                    <strong>{reportToDelete.clientName}</strong>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={!canDelete}
                  onClick={executeDelete}
                >
                  <i className="bi bi-trash-fill" /> Eliminar Definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componente: resalta el texto que coincide con el query ───────────────

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const q = normalize(query.trim());
  const lower = normalize(text);
  const idx = lower.indexOf(q);

  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="px-0 py-0" style={{ background: "#fff3cd", borderRadius: "2px" }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}
