import { useEffect, useState } from 'react';
import api from '../api';
import { type ReportSummary, type ReportData } from '../types';
import { pdf } from '@react-pdf/renderer';
import { PDFReport } from './PDFReport';
import { saveAs } from 'file-saver'; // Necesitarás: npm install file-saver @types/file-saver

interface Props {
  onCreateNew: () => void;
}

export default function ReportList({ onCreateNew }: Props) {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

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
      // 1. Obtener datos completos del reporte
      const res = await api.get(`/reports/${id}`);
      const fullData: ReportData = res.data.data; // El JSON guardado en BD
      
      // 2. Generar el Blob del PDF
      const blob = await pdf(<PDFReport data={fullData} />).toBlob();
      
      // 3. Descargar archivo
      saveAs(blob, `OT-${ticketNumber}.pdf`);
    } catch (error) {
      alert('Error al generar el PDF');
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Historial de Informes</h2>
        <button className="btn btn-primary rounded-circle" onClick={onCreateNew} style={{width: '50px', height: '50px'}}>
          <i className="bi bi-plus-lg" style={{fontSize: '1.2rem'}}></i>
        </button>
      </div>

      {loading ? <p>Cargando...</p> : (
        <div className="list-group">
            {reports.map(report => (
                <div key={report.id} className="list-group-item list-group-item-action d-flex justify-content-between align-items-center">
                    <div>
                        <h6 className="mb-1">{report.clientName}</h6>
                        <small className="text-muted">
                            Fecha: {new Date(report.createdAt).toLocaleDateString()} | OT: {report.ticketNumber}
                        </small>
                    </div>
                    <button 
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handleDownload(report.id, report.ticketNumber)}
                    >
                        <i className="bi bi-download"></i>
                    </button>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}