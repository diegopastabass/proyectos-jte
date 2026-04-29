import { type QuoteData } from "../types";

interface Props {
  data: QuoteData;
  isEditing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SaveSummaryModal({
  data,
  isEditing,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-success text-white">
            <h5 className="modal-title">
              {isEditing ? "Confirmar Edición" : "Confirmar Creación"}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onCancel}
            ></button>
          </div>
          <div className="modal-body">
            <p className="mb-3">
              Estás a punto de guardar la siguiente cotización:
            </p>

            <div className="card mb-3 bg-light border-0">
              <div className="card-body">
                <h6 className="card-subtitle text-muted mb-2">
                  Cliente / Proyecto
                </h6>
                <p className="fw-bold mb-1">{data.clientName}</p>
                <small className="text-secondary">{data.project}</small>
              </div>
            </div>

            <ul className="list-group mb-3">
              <li className="list-group-item d-flex justify-content-between align-items-center">
                Items totales
                <span className="badge bg-secondary rounded-pill">
                  {data.items.length}
                </span>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>Neto</span>
                <span>${data.subtotal.toLocaleString()}</span>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span>IVA (19%)</span>
                <span>${data.iva.toLocaleString()}</span>
              </li>
              <li className="list-group-item d-flex justify-content-between list-group-item-primary fw-bold">
                <span>Total Final</span>
                <span>${data.total.toLocaleString()}</span>
              </li>
            </ul>

            <div className="alert alert-warning py-2 small">
              <i className="bi bi-info-circle me-1"></i>
              ¿Deseas proceder o seguir editando?
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onCancel}
            >
              Seguir Editando
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={onConfirm}
            >
              <i className="bi bi-check-lg me-2"></i>
              {isEditing ? "Guardar Cambios" : "Confirmar y Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
