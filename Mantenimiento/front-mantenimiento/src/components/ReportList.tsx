import { useEffect, useState } from 'react';
import api from '../api';
import { type ReportSummary, type ReportData } from '../types';
import { pdf } from '@react-pdf/renderer';
import { PDFReport } from './PDFReport';
import { saveAs } from 'file-saver';

interface Props {
  onCreateNew: () => void;
  onEdit: (id: string) => void; // Nuevo prop para manejar la edición
}

export default function ReportList({ onCreateNew, onEdit }: Props) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para el Modal de eliminación
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<ReportSummary | null>(null);
  const [deleteCheck, setDeleteCheck] = useState(false);
  const [deleteNameInput, setDeleteNameInput] = useState('');

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/reports');
      setReports(res.data);
    } catch (error) {
      console.error("Error fetching reports", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: string, ticketNumber: string) => {
    try {
      const res = await api.get(`/reports/${id}`);
      const fullData: ReportData = res.data.data;
      const blob = await pdf(<PDFReport data={fullData} />).toBlob();
      saveAs(blob, `OT-${ticketNumber}.pdf`);
    } catch (error) {
      alert('Error al generar el PDF');
    }
  };

  // Preparar eliminación
  const confirmDelete = (report: ReportSummary) => {
    setReportToDelete(report);
    setDeleteCheck(false);
    setDeleteNameInput('');
    setShowDeleteModal(true);
  };

  // Ejecutar eliminación
  const executeDelete = async () => {
    if (!reportToDelete) return;
    try {
      await api.delete(`/reports/${reportToDelete.id}`);
      setReports(prev => prev.filter(r => r.id !== reportToDelete.id));
      setShowDeleteModal(false);
      setReportToDelete(null);
    } catch (error) {
      alert("Error al eliminar el reporte");
    }
  };

  // Validación para habilitar el botón de borrar
  const canDelete = reportToDelete && deleteCheck && deleteNameInput.trim() === reportToDelete.clientName;

  return (
    <div className="container py-4">
      {/* --- LISTADO --- */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Historial de Informes</h2>
        <button className="btn btn-primary rounded-circle shadow" onClick={onCreateNew} style={{width: '50px', height: '50px'}}>
          <i className="bi bi-plus-lg" style={{fontSize: '1.2rem'}}></i>
        </button>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div className="list-group shadow-sm">
            {reports.map(report => (
                <div key={report.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    <div>
                        <h6 className="mb-1 fw-bold">OT-{report.ticketNumber} | {report.clientName}</h6>
                        <small className="text-muted">
                            Fecha: {new Date(report.createdAt).toLocaleDateString()} | Estado: {report.status}
                        </small>
                    </div>
                    <div className="btn-group">
                        <button 
                            className="btn btn-outline-secondary btn-sm"
                            title="Descargar PDF"
                            onClick={() => handleDownload(report.id, report.ticketNumber)}
                        >
                            <i className="bi bi-download"></i>
                        </button>
                        <button 
                            className="btn btn-outline-primary btn-sm"
                            title="Editar Informe"
                            onClick={() => onEdit(report.id)}
                        >
                            <i className="bi bi-pencil"></i>
                        </button>
                        <button 
                            className="btn btn-outline-danger btn-sm"
                            title="Eliminar Informe"
                            onClick={() => confirmDelete(report)}
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* --- MODAL PERSONALIZADO DE ELIMINACIÓN --- */}
      {showDeleteModal && reportToDelete && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title">Eliminar Informe OT-{reportToDelete.ticketNumber}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowDeleteModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="text-danger fw-bold">Esta acción es irreversible.</p>
                
                <div className="form-check mb-3">
                  <input 
                    className="form-check-input" 
                    type="checkbox" 
                    id="confirmCheck" 
                    checked={deleteCheck}
                    onChange={e => setDeleteCheck(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="confirmCheck">
                    Estoy seguro de querer eliminar este informe. No se podrá recuperar si así se desea.
                  </label>
                </div>

                <div className="mb-3">
                  <label className="form-label">Escriba el nombre del cliente para confirmar:</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder={`Escriba: ${reportToDelete.clientName}`}
                    value={deleteNameInput}
                    onChange={e => setDeleteNameInput(e.target.value)}
                  />
                  <div className="form-text">Debe coincidir exactamente con: <strong>{reportToDelete.clientName}</strong></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  disabled={!canDelete}
                  onClick={executeDelete}
                >
                  <i className="bi bi-trash-fill"></i> Eliminar Definitivamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}