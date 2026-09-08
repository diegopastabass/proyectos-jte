import React, { useEffect, useState } from 'react';
import { ViewState } from '../types';
import Loading from './Loading';
import api from '../api';
import { format } from 'date-fns';
import SwipeableItem from './SwipeableItem';
import ConfirmationModal from './ConfirmationModal';
import EditChecklistModal from './EditChecklistModal';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ReportDocument } from './PDFChecklistReport';

interface ChecklistListProps {
  setViewState: (view: ViewState) => void;
  addToast: (msg: string, type: 'success'|'error'|'warning'|'info') => void;
  onSelectChecklist: (checklist: any) => void;
}

const ChecklistList: React.FC<ChecklistListProps> = ({ setViewState, addToast, onSelectChecklist }) => {
  const [checklists, setChecklists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklistToDelete, setChecklistToDelete] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [checklistToEdit, setChecklistToEdit] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    try {
      const response = await api.get('/checklists');
      console.log('Checklist[0] keys:', Object.keys(response.data[0]));
      console.log('Checklist[0].vehicle:', response.data[0]?.vehicle);
      console.log('Checklist[0].user:', response.data[0]?.user);
      setChecklists(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      addToast('Error al cargar checklists', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM');
    } catch {
      return dateStr;
    }
  };

  const handleDeleteClick = (checklist: any) => {
    setChecklistToDelete(checklist);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!checklistToDelete) return;
    try {
      await api.delete(`/checklists/${checklistToDelete.id}`);
      setChecklists(checklists.filter((c) => c.id !== checklistToDelete.id));
      addToast("Checklist eliminado", "success");
    } catch (error) {
      addToast("Error al eliminar checklist", "error");
    } finally {
      setShowDeleteModal(false);
      setChecklistToDelete(null);
    }
  };

  const handleEditClick = (checklist: any) => {
    setChecklistToEdit(checklist);
    setShowEditModal(true);
  };

  const handleCardClick = (checklist: any) => {
    onSelectChecklist(checklist);
    setViewState('checklist-detail');
  };

  if (loading) return <Loading />;

  return (
    <div>
      <h4 className="text-dark mb-3 text-dark">Historial de Checklists</h4>

      {checklists.length === 0 ? (
        <div className="text-center py-5">
          <div className="glass-card p-5 d-inline-block" style={{ maxWidth: '500px', width: '100%' }}>
            <i className="bi bi-clipboard-x text-secondary mb-3" style={{ fontSize: '3.5rem' }}></i>
            <h4 className="fw-bold">No hay checklists registrados</h4>
            <p className="text-secondary mb-0">Los checklists aparecerán aquí una vez que se hayan creado.</p>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {checklists.map((c) => (
            <div key={c.id} className="col-12 col-md-6 col-lg-4">
              <SwipeableItem 
                onSwipeRight={() => handleDeleteClick(c)} 
                onSwipeLeft={() => handleEditClick(c)}
              >
                <div 
                  className="vehicle-card p-3 h-100 d-flex flex-column" 
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleCardClick(c)}
                >
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h5 className="mb-0 fw-bold">{c.vehicle?.patente || '-'}</h5>
                      <div className="text-secondary small">{c.user?.name || '-'}</div>
                    </div>
                    <div className="text-end">
                      <div className="text-secondary small fw-bold">{formatDate(c.created_at)}</div>
                      <div className="mt-1">
                        {c.has_issues ? (
                          <span className="badge bg-danger">PROBLEMAS</span>
                        ) : (
                          <span className="badge bg-success">OK</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-3 border-top d-flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <PDFDownloadLink 
                      document={<ReportDocument data={c} />} 
                      fileName={`checklist_${c.vehicle?.patente || 'vehiculo'}_${formatDate(c.created_at).replace('/', '')}.pdf`}
                      className="btn btn-sm btn-outline-danger flex-grow-1 d-flex align-items-center justify-content-center"
                    >
                      <><i className="bi bi-file-pdf me-1"></i> Exportar PDF</>
                    </PDFDownloadLink>

                    <div className="d-none d-md-flex gap-2">
                      <button className="btn btn-sm btn-outline-secondary px-2" onClick={() => handleEditClick(c)} title="Editar">
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-sm btn-outline-danger px-2" onClick={() => handleDeleteClick(c)} title="Eliminar">
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </SwipeableItem>
            </div>
          ))}
        </div>
      )}

      <ConfirmationModal
        show={showDeleteModal}
        title="Eliminar Checklist"
        message={`¿Estás seguro de que deseas eliminar este checklist? Esta acción no se puede deshacer.`}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      {showEditModal && (
        <EditChecklistModal
          show={showEditModal}
          checklist={checklistToEdit}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};

export default ChecklistList;
