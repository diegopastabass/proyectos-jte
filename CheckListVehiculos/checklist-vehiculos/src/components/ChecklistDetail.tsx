import React, { useEffect, useState } from 'react';
import { ViewState } from '../types';
import api from '../api';
import Loading from './Loading';
import { formatDateTime, formatForFilename } from '../utils/dates';
import { photoUrl } from '../utils/urls';

interface ChecklistDetailProps {
  setViewState: (view: ViewState) => void;
  checklist: any;
  onLoaded?: (checklist: any) => void;
}

const ChecklistDetail: React.FC<ChecklistDetailProps> = ({ setViewState, checklist, onLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Tras recargar la pestaña el checklist en memoria se pierde: se vuelve a pedir por id
  useEffect(() => {
    if (checklist) return;
    let id: string | null = null;
    try { id = sessionStorage.getItem('selected_checklist_id'); } catch { /* sin storage */ }
    if (!id) return;
    setLoading(true);
    api.get(`/checklists/${id}`)
      .then((r) => onLoaded?.(r.data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [checklist]);

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const [{ pdf }, { saveAs }, { ReportDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('file-saver'),
        import('./PDFChecklistReport'),
      ]);
      const blob = await pdf(<ReportDocument data={checklist} />).toBlob();
      saveAs(blob, `checklist_${checklist.vehicle?.patente || 'vehiculo'}_${formatForFilename(checklist.created_at)}.pdf`);
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading) return <Loading />;

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

  const formatDate = formatDateTime;

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
        <button className="btn btn-outline-danger" onClick={exportPdf} disabled={pdfBusy}>
          <i className="bi bi-file-pdf me-1"></i> {pdfBusy ? 'Generando…' : 'Exportar PDF'}
        </button>
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
                    src={photoUrl(img.image_path)}
                    loading="lazy"
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
