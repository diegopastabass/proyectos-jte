import React, { useState, useEffect, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "./ReportsHistoryModal.css";

// ─── Tipos ──────────────────────────────────────────────────
interface ReportData {
  id: number;
  freatico: number;
  caudal: number;
  totalizador: number;
  response: any;
  time: string;
}

interface ReportsHistoryModalProps {
  show: boolean;
  onClose: () => void;
}

type ViewMode = "year" | "month";
type ReportStatus = "success" | "error" | "warning" | "none";

// ─── Helpers de fecha ───────────────────────────────────────
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const WEEKDAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const getDaysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

/** Día de la semana (0=Lun … 6=Dom) con lunes como inicio */
const getStartDayOfWeek = (year: number, month: number): number => {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
};

// ─── Helper de estado del reporte ───────────────────────────
const getReportStatus = (report: ReportData): ReportStatus => {
  const resp = report.response;
  if (!resp) return "none";

  // HTTP status codes del response
  const httpStatus = resp.statusCode ?? resp.status;

  // Si tiene exception o es 404/500 → error
  if (resp.exception) return "error";
  if (httpStatus === 404 || httpStatus === 500) return "error";

  // Status 400 → warning (ya estaba reportado)
  if (httpStatus === 400) return "warning";

  // Status "00" de la DGA o HTTP 200/201 → success
  if (httpStatus === 200 || httpStatus === 201 || resp.status === "00") return "success";

  // Si tiene data con comprobante → success
  if (resp.data?.numeroComprobante) return "success";

  // Fallback: si llegó respuesta sin error → success
  return "success";
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  success: "Exitoso",
  error: "Error",
  warning: "Ya reportado",
  none: "Sin dato",
};

// ─── Componente principal ───────────────────────────────────
const ReportsHistoryModal: React.FC<ReportsHistoryModalProps> = ({ show, onClose }) => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("year");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  // Key para forzar re-animación al cambiar de vista
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    if (show) {
      setLoading(true);
      setSelectedReport(null);
      setSelectedMonth(null);
      setViewMode("year");
      setSelectedYear(new Date().getFullYear());

      fetch("https://app.jteanalytics.cl/carracedo/reports")
        .then(res => res.json())
        .then(data => {
          setReports(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching reports", err);
          setLoading(false);
        });
    }
  }, [show]);

  // ── Datos indexados por año > mes > día ──
  const reportsByDate = useMemo(() => {
    const map: Record<string, ReportData[]> = {};
    reports.forEach(r => {
      const d = new Date(r.time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [reports]);

  // ── Años disponibles ──
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    reports.forEach(r => years.add(new Date(r.time).getFullYear()));
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [reports]);

  // ── Reportes del mes seleccionado ──
  const monthReports = useMemo(() => {
    if (selectedMonth === null) return [];
    return reports
      .filter(r => {
        const d = new Date(r.time);
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      })
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [reports, selectedYear, selectedMonth]);

  // ── Navegación ──
  const handleSelectMonth = useCallback((month: number) => {
    setSelectedMonth(month);
    setViewMode("month");
    setSelectedReport(null);
    setAnimKey(k => k + 1);
  }, []);

  const handleBackToYear = useCallback(() => {
    setSelectedMonth(null);
    setViewMode("year");
    setSelectedReport(null);
    setAnimKey(k => k + 1);
  }, []);

  const handleChangeYear = useCallback((delta: number) => {
    setSelectedYear(y => y + delta);
    setAnimKey(k => k + 1);
  }, []);

  // ── Formato de fecha ──
  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
  };

  // ── Export a Excel ──
  const handleExportToExcel = () => {
    const dataToExport = viewMode === "month" && selectedMonth !== null
      ? monthReports
      : reports;

    if (dataToExport.length === 0) {
      alert("No hay reportes para exportar.");
      return;
    }

    const worksheetData = [
      ["Fecha y Hora", "Nivel Freático (m)", "Caudal (l/s)", "Totalizador (m³)", "Estado Respuesta", "Mensaje Respuesta", "N° Comprobante"],
      ...dataToExport.map(report => {
        const date = new Date(report.time).toLocaleString("es-CL");
        const status = report.response?.status || (report.response?.exception ? "Error" : "N/A");
        const message = report.response?.message || report.response?.exception || "N/A";
        const comprobante = report.response?.data?.numeroComprobante || "N/A";
        return [date, report.freatico, report.caudal, report.totalizador, status, message, comprobante];
      }),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial Reportes");

    worksheet["!cols"] = [
      { wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 18 },
      { wch: 15 }, { wch: 45 }, { wch: 35 },
    ];

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const suffix = viewMode === "month" && selectedMonth !== null
      ? `${MONTH_NAMES[selectedMonth]}_${selectedYear}`
      : `${selectedYear}`;
    saveAs(blob, `Historial_Reportes_DGA_${suffix}.xlsx`);
  };

  // ── Determinar estado de un día ──
  const getDayStatus = useCallback((year: number, month: number, day: number): ReportStatus => {
    const key = `${year}-${month}-${day}`;
    const dayReports = reportsByDate[key];
    if (!dayReports || dayReports.length === 0) return "none";

    // Prioridad: si alguno es error → error, si alguno warning → warning, else success
    let hasError = false;
    let hasWarning = false;
    for (const r of dayReports) {
      const s = getReportStatus(r);
      if (s === "error") hasError = true;
      if (s === "warning") hasWarning = true;
    }
    if (hasError) return "error";
    if (hasWarning) return "warning";
    return "success";
  }, [reportsByDate]);

  // ── Contar reportes del mes por estado ──
  const getMonthStats = useCallback(
    (year: number, month: number) => {
      let success = 0;
      let error = 0;
      let warning = 0;
      const daysInMonth = getDaysInMonth(year, month);
      for (let d = 1; d <= daysInMonth; d++) {
        const status = getDayStatus(year, month, d);
        if (status === "success") success++;
        else if (status === "error") error++;
        else if (status === "warning") warning++;
      }
      return { success, error, warning };
    },
    [getDayStatus],
  );

  if (!show) return null;

  // ════════════════════════════════════════════════════════════
  //  R E N D E R
  // ════════════════════════════════════════════════════════════

  const renderMonthHeatmap = (month: number) => {
    const daysInMonth = getDaysInMonth(selectedYear, month);
    const startDay = getStartDayOfWeek(selectedYear, month);
    const stats = getMonthStats(selectedYear, month);

    const cells: React.ReactNode[] = [];

    // Espacios vacíos antes del primer día
    for (let i = 0; i < startDay; i++) {
      cells.push(<div key={`empty-${i}`} className="rhm-heatmap-cell rhm-cell-empty" />);
    }

    // Días del mes
    for (let d = 1; d <= daysInMonth; d++) {
      const status = getDayStatus(selectedYear, month, d);
      const tooltip = `${d} ${MONTH_NAMES[month]} — ${STATUS_LABEL[status]}`;
      cells.push(
        <div
          key={d}
          className={`rhm-heatmap-cell rhm-cell-${status}`}
          data-tooltip={tooltip}
        >
          {d}
        </div>,
      );
    }

    return (
      <div
        key={`${selectedYear}-${month}`}
        className="rhm-month-card"
        style={{ animationDelay: `${month * 40}ms` }}
        onClick={() => handleSelectMonth(month)}
      >
        <div className="rhm-month-card-header">
          <span>{MONTH_NAMES[month]}</span>
          <div className="rhm-month-stats d-flex gap-1">
            {stats.success > 0 && (
              <span className="rhm-count-badge success">{stats.success}</span>
            )}
            {stats.error > 0 && (
              <span className="rhm-count-badge error">{stats.error}</span>
            )}
            {stats.warning > 0 && (
              <span className="rhm-count-badge warning">{stats.warning}</span>
            )}
          </div>
        </div>
        <div className="rhm-heatmap-container">
          <div className="rhm-heatmap-weekdays">
            {WEEKDAY_LABELS.map(w => (
              <div key={w} className="rhm-heatmap-weekday">{w}</div>
            ))}
          </div>
          <div className="rhm-heatmap-days">{cells}</div>
        </div>
      </div>
    );
  };

  // ── Vista de detalle de reporte ──
  const renderReportDetail = () => {
    if (!selectedReport) return null;
    return (
      <div className="p-3 rhm-slide-right" key={`detail-${selectedReport.id}`}>
        <button
          className="btn btn-sm btn-outline-secondary mb-3 d-flex align-items-center gap-2"
          onClick={() => setSelectedReport(null)}
        >
          <i className="bi bi-arrow-left"></i> Volver a la lista
        </button>
        <div className="card shadow-sm border-0 rhm-scale-in">
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
            <strong>Fecha de Envío:</strong>
            <span>{formatDate(selectedReport.time)}</span>
          </div>
          <ul className="list-group list-group-flush">
            <li className="list-group-item d-flex justify-content-between">
              <span className="text-muted">Nivel Freático</span>
              <strong>{selectedReport.freatico} m</strong>
            </li>
            <li className="list-group-item d-flex justify-content-between">
              <span className="text-muted">Caudal</span>
              <strong>{selectedReport.caudal} l/s</strong>
            </li>
            <li className="list-group-item d-flex justify-content-between">
              <span className="text-muted">Totalizador</span>
              <strong>{selectedReport.totalizador} m³</strong>
            </li>
          </ul>
          <div className="card-body bg-light rounded-bottom">
            <h6 className="text-secondary mb-2 border-bottom pb-1">Respuesta del Servidor (DGA):</h6>
            <pre className="mb-0 p-2 bg-white border rounded" style={{ fontSize: "0.85rem", whiteSpace: "pre-wrap" }}>
              {JSON.stringify(selectedReport.response, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  };

  // ── Vista lista del mes ──
  const renderMonthList = () => (
    <div key={`month-list-${animKey}`} className="rhm-fade-in">
      {/* Breadcrumb */}
      <div className="rhm-breadcrumb">
        <button className="rhm-breadcrumb-link" onClick={handleBackToYear}>
          {selectedYear}
        </button>
        <span className="rhm-breadcrumb-sep"><i className="bi bi-chevron-right"></i></span>
        <span className="rhm-breadcrumb-current">{MONTH_NAMES[selectedMonth!]}</span>
      </div>

      {monthReports.length === 0 ? (
        <div className="p-4 text-center text-muted rhm-fade-in">
          <i className="bi bi-calendar-x fs-2 d-block mb-2"></i>
          No hay reportes para {MONTH_NAMES[selectedMonth!]} {selectedYear}.
        </div>
      ) : (
        <div className="list-group list-group-flush">
          {monthReports.map((report, idx) => {
            const status = getReportStatus(report);
            const iconClass =
              status === "success"
                ? "bi-check-circle-fill text-success"
                : status === "error"
                  ? "bi-x-circle-fill text-danger"
                  : status === "warning"
                    ? "bi-exclamation-circle-fill text-warning"
                    : "bi-circle text-muted";

            return (
              <button
                key={report.id}
                type="button"
                className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3 rhm-report-list-item"
                style={{ animationDelay: `${idx * 30}ms` }}
                onClick={() => setSelectedReport(report)}
              >
                <div className="d-flex align-items-center gap-3">
                  <i className={`bi ${iconClass} fs-5`}></i>
                  <div className="d-flex flex-column text-start">
                    <span className="fw-semibold">Reporte DGA</span>
                    <span className="text-muted small">{formatDate(report.time)}</span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className={`badge bg-${status === "success" ? "success" : status === "error" ? "danger" : status === "warning" ? "warning" : "secondary"} bg-opacity-10 text-${status === "success" ? "success" : status === "error" ? "danger" : status === "warning" ? "warning" : "secondary"}`}>
                    {STATUS_LABEL[status]}
                  </span>
                  <i className="bi bi-chevron-right text-muted"></i>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Vista año (heatmap) ──
  const renderYearView = () => (
    <div key={`year-${selectedYear}-${animKey}`}>
      {/* Toolbar */}
      <div className="rhm-toolbar">
        <div className="rhm-year-selector">
          <button
            className="btn btn-outline-secondary"
            onClick={() => handleChangeYear(-1)}
            disabled={!availableYears.includes(selectedYear - 1)}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <span className="rhm-year-label">{selectedYear}</span>
          <button
            className="btn btn-outline-secondary"
            onClick={() => handleChangeYear(1)}
            disabled={selectedYear >= new Date().getFullYear()}
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>

      {/* Grilla de meses */}
      <div className="rhm-months-grid">
        {Array.from({ length: 12 }, (_, i) => renderMonthHeatmap(i))}
      </div>

      {/* Leyenda */}
      <div className="rhm-legend">
        <div className="rhm-legend-item">
          <div className="rhm-legend-dot" style={{ background: "#40c057" }} />
          <span>Exitoso</span>
        </div>
        <div className="rhm-legend-item">
          <div className="rhm-legend-dot" style={{ background: "#fa5252" }} />
          <span>Error (404/500)</span>
        </div>
        <div className="rhm-legend-item">
          <div className="rhm-legend-dot" style={{ background: "#fab005" }} />
          <span>Ya reportado (400)</span>
        </div>
        <div className="rhm-legend-item">
          <div className="rhm-legend-dot" style={{ background: "#f1f3f5" }} />
          <span>Sin dato</span>
        </div>
      </div>
    </div>
  );

  // ── Cuerpo del modal ──
  const renderBody = () => {
    if (loading) {
      return (
        <div className="p-4 text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
          <div className="mt-2 text-muted">Cargando historial...</div>
        </div>
      );
    }

    if (selectedReport) return renderReportDetail();

    if (viewMode === "month" && selectedMonth !== null) return renderMonthList();

    return renderYearView();
  };

  // ── Título dinámico ──
  const getTitle = () => {
    if (selectedReport) return "Detalle de Reporte";
    if (viewMode === "month" && selectedMonth !== null)
      return `Reportes — ${MONTH_NAMES[selectedMonth].charAt(0).toUpperCase() + MONTH_NAMES[selectedMonth].slice(1)} ${selectedYear}`;
    return "Historial de Reportes DGA";
  };

  // ── Botón atrás del header ──
  const handleHeaderBack = () => {
    if (selectedReport) {
      setSelectedReport(null);
    } else if (viewMode === "month" && selectedMonth !== null) {
      handleBackToYear();
    } else {
      onClose();
    }
  };

  return (
    <div
      className="modal fade show d-block rhm-modal-wide"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", overflowY: "auto" }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
        <div className="modal-content rhm-scale-in">
          {/* Header */}
          <div className="modal-header">
            <div className="d-flex align-items-center gap-2">
              {(selectedReport || (viewMode === "month" && selectedMonth !== null)) && (
                <button
                  className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                  style={{ width: 30, height: 30, padding: 0, borderRadius: "50%" }}
                  onClick={handleHeaderBack}
                >
                  <i className="bi bi-arrow-left"></i>
                </button>
              )}
              <h5 className="modal-title mb-0">{getTitle()}</h5>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body p-0">{renderBody()}</div>

          {/* Footer */}
          <div className="modal-footer d-flex justify-content-between">
            <button
              type="button"
              className="btn btn-success d-flex align-items-center gap-2"
              onClick={handleExportToExcel}
              disabled={reports.length === 0 || loading || selectedReport !== null}
            >
              <i className="bi bi-file-earmark-excel"></i>
              {viewMode === "month" && selectedMonth !== null
                ? `Descargar ${MONTH_NAMES[selectedMonth].charAt(0).toUpperCase() + MONTH_NAMES[selectedMonth].slice(1)}`
                : "Descargar Excel"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsHistoryModal;
