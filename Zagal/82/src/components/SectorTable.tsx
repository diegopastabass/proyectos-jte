import StatusLed from "./StatusLed";
import { TOTALIZADOR_FACTOR } from "../config";
import { diffDays } from "../lib/dates";
import { formatDuration, formatNumber, relativeDays } from "../lib/format";
import { STALE_DAYS } from "../lib/metrics";
import type { Sector } from "../lib/sectors";
import type { IrrigationInterval } from "../hooks/useLiveData";

interface Props {
  sectors: Sector[];
  intervals: IrrigationInterval[];
  /** Último día con riego por sector (YYYY-MM-DD) */
  lastIrrigation: Record<string, string>;
  stale: Set<string>;
  today: string;
  selected: string;
  onSelect: (sectorId: string) => void;
}

// Estado actual de cada sector: si está regando, cuánto lleva y cuándo regó por última vez
function SectorTable({ sectors, intervals, lastIrrigation, stale, today, selected, onSelect }: Props) {
  const byId = new Map(intervals.map((i) => [i.mt_name, i]));

  return (
    <div className="table-scroll">
      <table className="dash-table">
        <thead>
          <tr>
            <th>Sector</th>
            <th>Estado</th>
            <th className="num d-none d-sm-table-cell">En curso</th>
            <th className="num d-none d-sm-table-cell">Volumen m³</th>
            <th>Último riego</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s) => {
            const live = byId.get(s.id);
            const active = live?.is_active === 1;
            const last = lastIrrigation[s.id];
            const days = last ? diffDays(last, today) : null;
            return (
              <tr
                key={s.id}
                className={selected === s.id ? "is-selected" : ""}
                onClick={() => onSelect(s.id)}
                title="Ver historial de este sector"
              >
                <td className="fw-semibold">{s.label}</td>
                <td>
                  <StatusLed status={active ? 1 : 0} />
                </td>
                <td className="num d-none d-sm-table-cell">
                  {active ? formatDuration(live!.tiempo_riego_segundos) : "—"}
                </td>
                <td className="num d-none d-sm-table-cell">
                  {active ? formatNumber((live!.totalizador ?? 0) * TOTALIZADOR_FACTOR, 1) : "—"}
                </td>
                <td>
                  {active ? (
                    <>
                      Ahora
                      <span className="d-sm-none"> · {formatDuration(live!.tiempo_riego_segundos)}</span>
                    </>
                  ) : stale.has(s.id) ? (
                    <span
                      className="warn-text"
                      title={`Sin riego hace ${STALE_DAYS} días o más mientras otros sectores sí riegan`}
                    >
                      <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true" />
                      {days === null ? "Sin riego reciente" : relativeDays(days)}
                    </span>
                  ) : days === null ? (
                    <span className="text-muted">Sin riego reciente</span>
                  ) : (
                    relativeDays(days)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default SectorTable;
