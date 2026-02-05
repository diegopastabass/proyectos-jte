import { useState } from "react";
import { type Quote } from "../types";

interface Props {
  quote: Quote;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  quote,
  onConfirm,
  onCancel,
}: Props) {
  const [inputName, setInputName] = useState("");
  const [isChecked, setIsChecked] = useState(false);

  const isNameCorrect = inputName === quote.data.project;
  const canDelete = isNameCorrect && isChecked;

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-danger text-white">
            <h5 className="modal-title">Eliminar Cotización</h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onCancel}
            ></button>
          </div>
          <div className="modal-body">
            <p>
              Estás a punto de eliminar la cotización folio:{" "}
              <strong>{quote.folio}</strong>.
            </p>
            <p className="text-danger">Esta acción no se puede deshacer.</p>

            <div className="mb-3">
              <label className="form-label">
                Escribe el nombre del proyecto para confirmar: <br />
                <strong>{quote.data.project}</strong>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Escribe el nombre aquí..."
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onPaste={(e) => e.preventDefault()}
              />
            </div>

            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="confirmCheck"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="confirmCheck">
                Entiendo que la cotización será eliminada permanentemente.
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={!canDelete}
              onClick={onConfirm}
            >
              Eliminar Definitivamente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
