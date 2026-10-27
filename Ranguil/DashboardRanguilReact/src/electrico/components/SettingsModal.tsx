import { useState } from "react";
import type { ElectricConfig } from "../types";
import { DEFAULT_CONFIG } from "../lib/config";

interface SettingsModalProps {
  config: ElectricConfig;
  onSave: (config: ElectricConfig) => void;
  onClose: () => void;
}

const FIELDS: {
  key: keyof ElectricConfig;
  label: string;
  hint: string;
  step: number;
}[] = [
  {
    key: "tarifaClpKwh",
    label: "Tarifa ($/kWh)",
    hint: "Valor referencial para estimar costos.",
    step: 1,
  },
  {
    key: "kwhFactor",
    label: "Factor del registro kWh",
    hint: "Multiplicador del contador del PLC para obtener kWh reales. Validar contra el medidor.",
    step: 0.1,
  },
  {
    key: "vNominal",
    label: "Tensión nominal fase-neutro (V)",
    hint: "Referencia para las bandas y desvíos.",
    step: 1,
  },
  {
    key: "iNominal",
    label: "Corriente de placa del motor (A)",
    hint: "Referencia para detectar sobrecarga.",
    step: 0.1,
  },
];

const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState(config);

  const valid = FIELDS.every((f) => Number.isFinite(draft[f.key]) && draft[f.key] > 0);

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Parámetros del análisis</h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body">
            {FIELDS.map((f) => (
              <div className="mb-3" key={f.key}>
                <label className="form-label" htmlFor={`cfg-${f.key}`}>
                  {f.label}
                </label>
                <input
                  id={`cfg-${f.key}`}
                  type="number"
                  className="form-control"
                  step={f.step}
                  min={0}
                  value={Number.isFinite(draft[f.key]) ? draft[f.key] : ""}
                  onChange={(e) =>
                    setDraft({ ...draft, [f.key]: e.target.valueAsNumber })
                  }
                />
                <div className="form-text">{f.hint}</div>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary me-auto"
              onClick={() => setDraft(DEFAULT_CONFIG)}
            >
              Restablecer
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!valid}
              onClick={() => onSave(draft)}
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
