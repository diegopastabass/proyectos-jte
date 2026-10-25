import { formatDelta, formatHours, formatNumber } from "../lib/format";
import type { PeriodTotals, SectorSummary } from "../lib/metrics";
import { sectorLabel } from "../lib/sectors";

interface Props {
  rows: SectorSummary[];
  total: PeriodTotals;
  selected: string;
  onSelect: (sectorId: string) => void;
  comparisonLabel: string;
}

// Variación de caudal que amerita revisar el sector (filtros, goteros, fugas)
export const CAUDAL_ALERT = 0.2;

function SectorSummaryTable({ rows, total, selected, onSelect, comparisonLabel }: Props) {
  const maxShare = Math.max(0.0001, ...rows.map((r) => r.share));
  const shareBy = total.volume > 0 ? "volumen" : "tiempo";

  return (
    <div className="table-scroll">
      <table className="dash-table">
        <thead>
          <tr>
            <th>Sector</th>
            <th className="num">Horas</th>
            <th className="num">Volumen m³</th>
            <th>% del {shareBy}</th>
            <th className="num">Días con riego</th>
            <th className="num">Caudal prom. l/s</th>
            <th className="num" title={`Variación del caudal promedio ${comparisonLabel}`}>
              Δ caudal
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const alert = r.caudalDelta !== null && Math.abs(r.caudalDelta) >= CAUDAL_ALERT;
            return (
              <tr
                key={r.id}
                className={selected === r.id ? "is-selected" : ""}
                onClick={() => onSelect(r.id)}
              >
                <td className="fw-semibold">{sectorLabel(r.id)}</td>
                <td className="num">{formatHours(r.seconds)}</td>
                <td className="num">{r.volumeMissing ? "—" : formatNumber(r.volume, 1)}</td>
                <td>
                  <div className="inline-bar">
                    <div className="inline-bar__track">
                      <div className="inline-bar__fill" style={{ width: `${(r.share / maxShare) * 100}%` }} />
                    </div>
                    <span className="num" style={{ minWidth: 36 }}>
                      {Math.round(r.share * 100)}%
                    </span>
                  </div>
                </td>
                <td className="num">{r.irrigationDays}</td>
                <td className="num">{r.avgCaudal !== null ? formatNumber(r.avgCaudal, 1) : "—"}</td>
                <td className="num">
                  {r.caudalDelta === null ? (
                    "—"
                  ) : alert ? (
                    <span
                      className="warn-text"
                      title={`El caudal promedio cambió ${formatDelta(r.caudalDelta)} ${comparisonLabel}: conviene revisar filtros, emisores o posibles fugas`}
                    >
                      <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true" />
                      {formatDelta(r.caudalDelta)}
                    </span>
                  ) : (
                    formatDelta(r.caudalDelta)
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td>Total parcela</td>
            <td className="num">{formatHours(total.seconds)}</td>
            <td className="num">{total.volumeMissing ? "—" : formatNumber(total.volume, 1)}</td>
            <td />
            <td className="num">{total.irrigationDays}</td>
            <td className="num">{total.avgCaudal !== null ? formatNumber(total.avgCaudal, 1) : "—"}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default SectorSummaryTable;
