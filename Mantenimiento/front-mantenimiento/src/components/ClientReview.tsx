import { type ReportData } from '../types';

interface Props {
  data: ReportData;
  onCorrect: () => void;
  onApprove: () => void;
}

export const ClientReview = ({ data, onCorrect, onApprove }: Props) => {
  return (
    <div className="card border-primary">
      <div className="card-header bg-primary text-white">
        <h5 className="mb-0">Revisión del Cliente</h5>
      </div>
      <div className="card-body">
        <h6 className="text-muted">Resumen de trabajos realizados:</h6>
        <div className="alert alert-light border">
          <p className="mb-2"><strong>Diagnóstico:</strong> {data.description}</p>
          <strong>Soluciones:</strong>
          <ul className="mb-0">
            {data.solutions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>

        <div className="form-check mb-3">
          <input className="form-check-input" type="checkbox" checked readOnly />
          <label className="form-check-label">
            Yo, <strong>{data.clientSigner}</strong>, declaro recibir conforme los trabajos descritos.
          </label>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary w-50" onClick={onCorrect}>
            <i className="bi bi-pencil"></i> Corregir
          </button>
          <button className="btn btn-success w-50" onClick={onApprove}>
            <i className="bi bi-check-lg"></i> Conforme, Firmar
          </button>
        </div>
      </div>
    </div>
  );
};