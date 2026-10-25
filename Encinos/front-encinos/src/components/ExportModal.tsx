// ExportModal.tsx
import Export from "./ExportToExcel";

interface ExportModalProps {
  show: boolean;
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({ show, onClose }) => {
  if (!show) {
    return null;
  }

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Exportar Historial de Datos</h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            <Export />
          </div>

          <div className="modal-footer">
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

export default ExportModal;
