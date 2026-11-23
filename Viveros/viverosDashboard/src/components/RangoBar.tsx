import { formatoNumero } from "../lib/formato";

interface RangoBarProps {
  valor: number | null;
  /** Mínimo y máximo de hoy. */
  hoyMin?: number;
  hoyMax?: number;
  rangoMin: number | null;
  rangoMax: number | null;
  decimales: number;
  /** Ancho mínimo de la escala (2 °C, 5 %…), para que una variable estable no se vea exagerada. */
  spanMinimo: number;
  limites?: [number, number];
  color: string;
}

/**
 * Barra de rango ("bullet chart"): franja verde con el rango permitido, línea gris
 * con el mínimo y el máximo de hoy, y un marcador con el valor actual.
 */
function RangoBar({
  valor,
  hoyMin,
  hoyMax,
  rangoMin,
  rangoMax,
  decimales,
  spanMinimo,
  limites,
  color,
}: RangoBarProps) {
  const valores = [valor, hoyMin, hoyMax, rangoMin, rangoMax].filter(
    (v): v is number => v !== null && v !== undefined,
  );
  if (!valores.length) return null;
  let lo = Math.min(...valores);
  let hi = Math.max(...valores);
  const pad = Math.max((hi - lo) * 0.15, (spanMinimo - (hi - lo)) / 2, spanMinimo * 0.1);
  lo -= pad;
  hi += pad;
  if (limites) {
    lo = Math.max(lo, limites[0]);
    hi = Math.min(hi, limites[1]);
  }
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;
  const hayRango = rangoMin !== null || rangoMax !== null;
  const bandaIni = rangoMin ?? lo;
  const bandaFin = rangoMax ?? hi;

  return (
    <div className="rango-bar" aria-hidden="true">
      <div className="rango-pista">
        {hayRango && (
          <div
            className="rango-permitido"
            style={{ left: pos(bandaIni), width: `calc(${pos(bandaFin)} - ${pos(bandaIni)})` }}
          />
        )}
        {hoyMin !== undefined && hoyMax !== undefined && (
          <div
            className="rango-hoy"
            style={{ left: pos(hoyMin), width: `calc(${pos(hoyMax)} - ${pos(hoyMin)})` }}
          />
        )}
        {valor !== null && (
          <div className="rango-marcador" style={{ left: pos(valor), background: color }} />
        )}
      </div>
      {hoyMin !== undefined && hoyMax !== undefined && (
        <div className="d-flex justify-content-between small text-body-secondary mt-1">
          <span>mín. hoy {formatoNumero(hoyMin, decimales)}</span>
          <span>máx. hoy {formatoNumero(hoyMax, decimales)}</span>
        </div>
      )}
    </div>
  );
}

export default RangoBar;
