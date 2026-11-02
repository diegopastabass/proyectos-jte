import { Link } from "react-router-dom";
import type { ResumenMotor } from "../types";

export default function ResultadoMotor({ r, onCerrar }: { r: ResumenMotor; onCerrar: () => void }) {
  return (
    <div className="alert alert-success d-flex align-items-start gap-2">
      <i className="bi bi-magic mt-1" />
      <div className="flex-grow-1">
        Se revisaron <strong>{r.movimientosEvaluados}</strong> movimientos: <strong>{r.conciliadosAutomaticamente}</strong> conciliados
        automáticamente{r.ignoradosPorRegla > 0 && <>, {r.ignoradosPorRegla} ignorados por regla</>}, <strong>{r.sugerencias}</strong>{" "}
        sugerencias para revisar y {r.sinPropuesta} sin coincidencia.
        {r.sugerencias > 0 && (
          <Link to="/bandeja" className="ms-2 alert-link">
            Ir a la bandeja
          </Link>
        )}
      </div>
      <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar} />
    </div>
  );
}
