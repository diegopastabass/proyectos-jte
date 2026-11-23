import { sumarDias } from "../lib/fechas";

interface DaySelectorProps {
  dia: string;
  hoy: string;
  onChange: (dia: string) => void;
}

function DaySelector({ dia, hoy, onChange }: DaySelectorProps) {
  return (
    <div className="d-flex align-items-center gap-1" role="group" aria-label="Seleccionar día">
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={() => onChange(sumarDias(dia, -1))}
        title="Día anterior"
        aria-label="Día anterior"
      >
        <i className="bi bi-chevron-left" />
      </button>
      <input
        type="date"
        className="form-control form-control-sm"
        style={{ width: "auto" }}
        value={dia}
        max={hoy}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        aria-label="Día"
      />
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        onClick={() => onChange(sumarDias(dia, 1))}
        disabled={dia >= hoy}
        title="Día siguiente"
        aria-label="Día siguiente"
      >
        <i className="bi bi-chevron-right" />
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline-primary ms-1"
        onClick={() => onChange(hoy)}
        disabled={dia === hoy}
      >
        Hoy
      </button>
    </div>
  );
}

export default DaySelector;
