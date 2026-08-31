import React from 'react';

interface ConfirmationModalProps {
  show: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary' | 'warning';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  show, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, onCancel, variant = 'primary'
}) => {
  if (!show) return null;

  return (
    <div className="modal d-block glass-modal" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content glass-card border-0">
          <div className="modal-header border-bottom border-secondary">
            <h5 className="modal-title text-dark">{title}</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onCancel}></button>
          </div>
          <div className="modal-body text-secondary">
            <p>{message}</p>
          </div>
          <div className="modal-footer border-top border-secondary">
            <button type="button" className="btn btn-outline-light" onClick={onCancel}>{cancelText}</button>
            <button type="button" className={`btn btn-${variant}`} onClick={onConfirm}>{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
