import React from 'react';
import { ViewState } from '../types';
import { format } from 'date-fns';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ReportDocument } from './PDFChecklistReport';

interface ChecklistDetailProps {
  setViewState: (view: ViewState) => void;
  checklist: any;
}

const ChecklistDetail: React.FC<ChecklistDetailProps> = ({ setViewState, checklist }) => {
  if (!checklist) {
    return (
      <div className="container-fluid py-4 fade-in">
        <button className="btn btn-link text-secondary text-decoration-none p-0" onClick={() => setViewState('checklist-list')}>
          <i className="bi bi-arrow-left me-1"></i> Volver
        </button>
        <p className="text-dark mt-4">No se encontró el checklist.</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy HH:mm');
    } catch {
      return dateStr;
    }
  };

  const renderCheckItems = (title: string, checks: Record<string, any>) => {
    if (!checks || typeof checks !== 'object') return null;
    const entries = Object.values(checks);
    if (entries.length === 0) return null;

    return (
      <div className="mb-4">
        <h6 className="text-dark mb-3">{title}</h6>
        <div className="list-group list-group-flush">
          {entries.map((item: any, idx: number) => (
            <div key={idx} className="list-group-item bg-transparent border-secondary px-0 py-2 text-dark d-flex justify-content-between align-items-start">
              <div>
                <span>{item.label || item.id}</span>
                {!item.isGood && item.observation && (
                  <div className="text-warning small mt-1">
                    <i className="bi bi-chat-text me-1"></i>{item.observation}
                  </div>
                )}
              </div>
              {item.isGood ? (
                <span className="badge bg-success">OK</span>
              ) : (
                <span className="badge bg-danger">MALO</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid py-4 fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <button className="btn btn-link text-secondary text-decoration-none p-0" onClick={() => setViewState('checklist-list')}>
          <i className="bi bi-arrow-left me-1"></i> Volver
        </button>
        <PDFDownloadLink 
          document={<ReportDocument data={checklist} />} 
          fileName={`checklist_${checklist.vehicle?.patente || 'vehiculo'}_${formatDate(checklist.created_at).replace('/', '')}.pdf`}
          className="btn btn-outline-danger"
        >
          <i className="bi bi-file-pdf me-1"></i> Exportar PDF
        </PDFDownloadLink>
      </div>

      <div className="glass-card p-4">
        <h4 className="text-dark border-bottom border-secondary pb-2 mb-4">Detalle Checklist #{checklist.id}</h4>
        
        <div className="row mb-4">
          <div className="col-6 col-md-3 mb-3">
            <div className="text-secondary small">Patente</div>
            <div className="text-dark fw-bold fs-5">{checklist.vehicle?.patente || '-'}</div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="text-secondary small">Fecha</div>
            <div className="text-dark">{formatDate(checklist.created_at)}</div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="text-secondary small">Operador</div>
            <div className="text-dark">{checklist.user?.name || '-'}</div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="text-secondary small">Estado</div>
            {checklist.has_issues ? (
              <span className="badge bg-danger">CON PROBLEMAS</span>
            ) : (
              <span className="badge bg-success">OK</span>
            )}
          </div>
        </div>

        <div className="row mb-4">
          <div className="col-6 col-md-3 mb-3">
            <div className="text-secondary small">Kilometraje</div>
            <div className="text-dark fw-bold">{checklist.kilometraje_actual?.toLocaleString()} km</div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="text-secondary small">Modelo</div>
            <div className="text-dark">{checklist.vehicle?.model || '-'}</div>
          </div>
        </div>

        {renderCheckItems('Inspección Visual', checklist.visual_checks)}
        {renderCheckItems('Inspección Mecánica', checklist.mechanical_checks)}
        
        {checklist.observaciones_generales && (
          <>
            <h6 className="text-dark mt-4 mb-2">Observaciones Generales</h6>
            <div className="p-3 bg-light rounded border border-secondary text-dark">
              {checklist.observaciones_generales}
            </div>
          </>
        )}

        {checklist.images && checklist.images.length > 0 && (
          <>
            <h6 className="text-dark mt-4 mb-3">Fotos Adjuntas</h6>
            <div className="row g-2">
              {checklist.images.map((img: any, idx: number) => (
                <div key={idx} className="col-6 col-md-3">
                  <img
                    src={`${import.meta.env.VITE_API_URL || 'https://app.jteanalytics.cl/checklist-vehiculos/'}/uploads/${img.image_path}`}
                    alt={img.description || `Foto ${idx + 1}`}
                    className="img-fluid rounded border border-secondary"
                    style={{ maxHeight: '200px', objectFit: 'cover', width: '100%' }}
                  />
                  <small className="text-secondary d-block mt-1">{img.description}</small>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default ChecklistDetail;
