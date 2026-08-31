import React from 'react';

interface EditChecklistModalProps {
  show: boolean;
  checklist: any;
  onClose: () => void;
}

const EditChecklistModal: React.FC<EditChecklistModalProps> = ({ show, checklist, onClose }) => {
  if (!show) return null;

  return (
    <>
      <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content glass-card">
            <div className="modal-header border-secondary">
              <h5 className="modal-title text-dark">Editar Checklist #{checklist?.id}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                <i className="bi bi-info-circle me-2"></i>
                La edición de checklists está en desarrollo. Pronto podrás modificar los detalles aquí.
              </div>
            </div>
            <div className="modal-footer border-secondary">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditChecklistModal;
