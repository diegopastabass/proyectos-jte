import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

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

const ReportsHistoryModal: React.FC<ReportsHistoryModalProps> = ({ show, onClose }) => {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);

  useEffect(() => {
    if (show) {
      setLoading(true);
      setSelectedReport(null);
      // Fetch reports history
      fetch("https://app.jteanalytics.cl/auquinco/reports")
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

  if (!show) {
    return null;
  }

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString("es-CL", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  const handleExportToExcel = () => {
    if (reports.length === 0) {
      alert("No hay reportes para exportar.");
      return;
    }

    const worksheetData = [
      ["Fecha y Hora", "Nivel Freático (m)", "Caudal (l/s)", "Totalizador (m³)", "Estado Respuesta", "Mensaje Respuesta", "N° Comprobante"],
      ...reports.map(report => {
        const date = new Date(report.time).toLocaleString("es-CL");
        const status = report.response?.status || (report.response?.exception ? "Error" : "N/A");
        const message = report.response?.message || report.response?.exception || "N/A";
        const comprobante = report.response?.data?.numeroComprobante || "N/A";
        
        return [
          date, 
          report.freatico, 
          report.caudal, 
          report.totalizador, 
          status, 
          message, 
          comprobante
        ];
      })
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial Reportes");

    // Ajustar el ancho de las columnas
    worksheet["!cols"] = [
      { wch: 20 }, // Fecha
      { wch: 18 }, // Freático
      { wch: 15 }, // Caudal
      { wch: 18 }, // Totalizador
      { wch: 15 }, // Estado
      { wch: 45 }, // Mensaje
      { wch: 35 }, // Comprobante
    ];

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const filename = `Historial_Reportes_DGA_${new Date().toISOString().split("T")[0]}.xlsx`;
    saveAs(blob, filename);
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", overflowY: "auto" }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {selectedReport ? "Detalle de Reporte" : "Historial de Reportes DGA"}
            </h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => {
                if (selectedReport) {
                  setSelectedReport(null);
                } else {
                  onClose();
                }
              }}
            ></button>
          </div>
          <div className="modal-body p-0">
            {loading ? (
              <div className="p-4 text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Cargando...</span>
                </div>
                <div className="mt-2 text-muted">Cargando historial...</div>
              </div>
            ) : selectedReport ? (
              <div className="p-3">
                <button 
                  className="btn btn-sm btn-outline-secondary mb-3 d-flex align-items-center gap-2"
                  onClick={() => setSelectedReport(null)}
                >
                  <i className="bi bi-arrow-left"></i> Volver a la lista
                </button>
                <div className="card shadow-sm border-0">
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
            ) : (
              <div className="list-group list-group-flush">
                {reports.length === 0 ? (
                  <div className="p-4 text-center text-muted">
                    <i className="bi bi-info-circle fs-2 d-block mb-2"></i>
                    No hay reportes disponibles.
                  </div>
                ) : (
                  reports.map(report => {
                    const isSuccess = report.response?.status === "00" || report.response?.status === 200 || !report.response?.exception;
                    return (
                      <button
                        key={report.id}
                        type="button"
                        className="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-3"
                        onClick={() => setSelectedReport(report)}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <i className={`bi bi-file-earmark-text fs-4 ${isSuccess ? 'text-primary' : 'text-warning'}`}></i>
                          <div className="d-flex flex-column text-start">
                            <span className="fw-semibold">Reporte DGA</span>
                            <span className="text-muted small">{formatDate(report.time)}</span>
                          </div>
                        </div>
                        <i className="bi bi-chevron-right text-muted"></i>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div className="modal-footer d-flex justify-content-between">
            <button
              type="button"
              className="btn btn-success d-flex align-items-center gap-2"
              onClick={handleExportToExcel}
              disabled={reports.length === 0 || loading || selectedReport !== null}
            >
              <i className="bi bi-file-earmark-excel"></i> Descargar Excel
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
