import { formatDelta } from "../lib/format";

interface StatTileProps {
  label: string;
  icon?: string;
  /** Aclaración que se muestra al pasar el mouse sobre el ícono (i) */
  hint?: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  className?: string;
}

function StatTile({ label, icon, hint, value, unit, sub, className = "" }: StatTileProps) {
  return (
    <div className={`stat-tile ${className}`}>
      <div className="stat-tile__label">
        {icon && <i className={`bi ${icon}`} aria-hidden="true" />}
        {label}
        {hint && <i className="bi bi-info-circle text-muted" title={hint} aria-label={hint} />}
      </div>
      <div className="stat-tile__value">
        {value}
        {unit && <span className="stat-tile__unit">{unit}</span>}
      </div>
      <div className="stat-tile__sub">{sub}</div>
    </div>
  );
}

/**
 * Variación vs. periodo anterior. Se muestra en tinta neutra: regar más o menos
 * no es "bueno" ni "malo" por sí solo, así que no se usan colores de estado.
 */
export function Delta({ ratio, label }: { ratio: number | null; label: string }) {
  if (ratio === null) return <span>Sin datos {label}</span>;
  const icon = ratio > 0.005 ? "bi-arrow-up-right" : ratio < -0.005 ? "bi-arrow-down-right" : "bi-arrow-right";
  return (
    <span>
      <span className="delta">
        <i className={`bi ${icon}`} aria-hidden="true" /> {formatDelta(ratio)}
      </span>{" "}
      {label}
    </span>
  );
}

export default StatTile;
