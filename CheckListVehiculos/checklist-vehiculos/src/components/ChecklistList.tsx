import React, { useCallback, useEffect, useState } from 'react';
import { Paginated, User, ViewState } from '../types';
import Loading from './Loading';
import api from '../api';
import ConfirmationModal from './ConfirmationModal';
import { formatShortDate, formatForFilename } from '../utils/dates';
import SwipeableItem from './SwipeableItem';

interface ChecklistListProps {
  user: User;
  setViewState: (view: ViewState) => void;
  addToast: (msg: string, type: 'success'|'error'|'warning'|'info') => void;
  onSelectChecklist: (checklist: any) => void;
}

const PAGE_SIZE = 12;

const ChecklistList: React.FC<ChecklistListProps> = ({ user, setViewState, addToast, onSelectChecklist }) => {
  const isAdmin = user.role === 'admin';
  const [data, setData] = useState<Paginated<any>>({ items: [], total: 0, page: 1, limit: PAGE_SIZE });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [patente, setPatente] = useState('');
  const [filters, setFilters] = useState({ patente: '', desde: '', hasta: '', estado: '' });
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [checklistToDelete, setChecklistToDelete] = useState<any>(null);

  const fetchChecklists = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (filters.patente) params.patente = filters.patente;
      if (filters.desde) params.desde = filters.desde;
      if (filters.hasta) params.hasta = filters.hasta;
      if (filters.estado) params.has_issues = filters.estado === 'problemas' ? 'true' : 'false';
      const response = await api.get('/checklists', { params });
      setData(response.data);
    } catch {
      addToast('Error al cargar checklists', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchChecklists();
  }, [fetchChecklists]);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setFilters((f) => ({ ...f, patente: patente.trim() }));
  };

  const clearFilters = () => {
    setPatente('');
    setPage(1);
    setFilters({ patente: '', desde: '', hasta: '', estado: '' });
  };

  // El PDF (que descarga todas las fotos) se arma solo al hacer clic, no al cargar la lista
  const exportPdf = async (c: any) => {
    setPdfBusy(c.id);
    try {
      const [{ pdf }, { saveAs }, { ReportDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('file-saver'),
        import('./PDFChecklistReport'),
      ]);
      const blob = await pdf(<ReportDocument data={c} />).toBlob();
      saveAs(blob, `checklist_${c.vehicle?.patente || 'vehiculo'}_${formatForFilename(c.created_at)}.pdf`);
    } catch {
      addToast('No se pudo generar el PDF', 'error');
    } finally {
      setPdfBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!checklistToDelete) return;
    try {
      await api.delete(`/checklists/${checklistToDelete.id}`);
      addToast('Checklist eliminado', 'success');
      fetchChecklists();
    } catch {
      addToast('Error al eliminar checklist', 'error');
    } finally {
      setChecklistToDelete(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const hasFilters = !!(filters.patente || filters.desde || filters.hasta || filters.estado);

  return (
    <div>
      <h4 className="text-dark mb-3">{isAdmin ? 'Historial de Checklists' : 'Mis Checklists'}</h4>

      <form className="glass-card p-3 mb-3 row g-2 align-items-end" onSubmit={applyFilters}>
        <div className="col-6 col-md-3">
          <label className="form-label small text-secondary mb-1">Patente</label>
          <input className="form-control form-control-sm text-uppercase" value={patente} maxLength={10} onChange={(e) => setPatente(e.target.value)} placeholder="ABCD12" />
        </div>
        <div className="col-6 col-md-2">
          <label className="form-label small text-secondary mb-1">Desde</label>
          <input type="date" className="form-control form-control-sm" value={filters.desde} onChange={(e) => { setPage(1); setFilters({ ...filters, desde: e.target.value }); }} />
        </div>
        <div className="col-6 col-md-2">
          <label className="form-label small text-secondary mb-1">Hasta</label>
          <input type="date" className="form-control form-control-sm" value={filters.hasta} onChange={(e) => { setPage(1); setFilters({ ...filters, hasta: e.target.value }); }} />
        </div>
        <div className="col-6 col-md-2">
          <label className="form-label small text-secondary mb-1">Estado</label>
          <select className="form-select form-select-sm" value={filters.estado} onChange={(e) => { setPage(1); setFilters({ ...filters, estado: e.target.value }); }}>
            <option value="">Todos</option>
            <option value="ok">OK</option>
            <option value="problemas">Con problemas</option>
          </select>
        </div>
        <div className="col-12 col-md-3 d-flex gap-2">
          <button className="btn btn-sm btn-primary flex-grow-1" type="submit"><i className="bi bi-search me-1"></i>Buscar</button>
          {hasFilters && <button className="btn btn-sm btn-outline-secondary" type="button" onClick={clearFilters}>Limpiar</button>}
        </div>
      </form>

      {loading ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <div className="text-center py-5">
          <div className="glass-card p-5 d-inline-block" style={{ maxWidth: '500px', width: '100%' }}>
            <i className="bi bi-clipboard-x text-secondary mb-3" style={{ fontSize: '3.5rem' }}></i>
            <h4 className="fw-bold">{hasFilters ? 'Sin resultados' : 'No hay checklists registrados'}</h4>
            <p className="text-secondary mb-0">
              {hasFilters ? 'Pruebe con otros filtros.' : 'Los checklists aparecerán aquí una vez que se hayan creado.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="row g-3">
            {data.items.map((c) => (
              <div key={c.id} className="col-12 col-md-6 col-lg-4">
                <SwipeableItem onSwipeRight={isAdmin ? () => setChecklistToDelete(c) : undefined}>
                  <div
                    className="vehicle-card p-3 h-100 d-flex flex-column"
                    style={{ cursor: 'pointer' }}
                    onClick={() => { onSelectChecklist(c); setViewState('checklist-detail'); }}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h5 className="mb-0 fw-bold">{c.vehicle?.patente || '-'}</h5>
                        <div className="text-secondary small">{c.user?.name || '-'}</div>
                      </div>
                      <div className="text-end">
                        <div className="text-secondary small fw-bold">{formatShortDate(c.created_at)}</div>
                        <div className="mt-1">
                          {c.has_issues ? <span className="badge bg-danger">PROBLEMAS</span> : <span className="badge bg-success">OK</span>}
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-3 border-top d-flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-sm btn-outline-danger flex-grow-1 d-flex align-items-center justify-content-center"
                        disabled={pdfBusy === c.id}
                        onClick={() => exportPdf(c)}
                      >
                        {pdfBusy === c.id ? (
                          <><span className="spinner-border spinner-border-sm me-1"></span> Generando…</>
                        ) : (
                          <><i className="bi bi-file-pdf me-1"></i> Exportar PDF</>
                        )}
                      </button>
                      {isAdmin && (
                        <button className="btn btn-sm btn-outline-danger px-2 d-none d-md-block" onClick={() => setChecklistToDelete(c)} title="Eliminar">
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
                    </div>
                  </div>
                </SwipeableItem>
              </div>
            ))}
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3">
            <small className="text-secondary">{data.total} checklist(s)</small>
            <div className="btn-group">
              <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <i className="bi bi-chevron-left"></i>
              </button>
              <span className="btn btn-sm btn-outline-secondary disabled">{page} / {totalPages}</span>
              <button className="btn btn-sm btn-outline-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmationModal
        show={!!checklistToDelete}
        title="Eliminar Checklist"
        message="¿Estás seguro de que deseas eliminar este checklist y sus fotos? Esta acción no se puede deshacer."
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setChecklistToDelete(null)}
      />
    </div>
  );
};

export default ChecklistList;
