import { useState } from "react";
import { MIN_MONTH, PARCELA, TOTALIZADOR_FACTOR } from "../config";
import { MONTH_NAMES, monthOf, todayChile, toMonthKey } from "../lib/dates";
import { loadMonthRange } from "../lib/summaryCache";
import { sectorLabel } from "../lib/sectors";

// Exporta meses completos usando la misma caché del dashboard: los meses ya
// vistos no se vuelven a pedir al backend.
function ExportHistorial() {
  const currentMonth = monthOf(todayChile());
  const [from, setFrom] = useState(currentMonth);
  const [to, setTo] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [minY] = MIN_MONTH.split("-").map(Number);
  const [curY] = currentMonth.split("-").map(Number);
  const options: string[] = [];
  for (let y = curY; y >= minY; y--) {
    for (let m = 12; m >= 1; m--) {
      const k = toMonthKey(y, m);
      if (k >= MIN_MONTH && k <= currentMonth) options.push(k);
    }
  }
  const label = (k: string) => `${MONTH_NAMES[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;

  const handleExport = async () => {
    if (from > to) {
      setError("El mes de inicio debe ser anterior o igual al de término.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const rows = await loadMonthRange(from, to);
      // xlsx pesa ~400 KB: se carga solo cuando alguien exporta
      const [XLSX, { saveAs }] = await Promise.all([import("xlsx"), import("file-saver")]);

      const data = [...rows]
        .sort((a, b) => a.date.localeCompare(b.date) || a.mt_name.localeCompare(b.mt_name))
        .map((r) => ({
          Fecha: r.date,
          Sector: sectorLabel(r.mt_name),
          "Tiempo de riego (h)": Number((r.value / 3600).toFixed(2)),
          "Tiempo de riego (s)": Math.round(r.value),
          "Volumen (m³)": Number((r.totalizador * TOTALIZADOR_FACTOR).toFixed(2)),
          "Caudal promedio (l/s)": Number(r.caudal.toFixed(2)),
        }));

      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(
        new Blob([buffer], { type: "application/octet-stream" }),
        `historialRiego_parcela${PARCELA}_${from}_${to}.xlsx`,
      );
    } catch (err) {
      console.error("Error exportando historial:", err);
      setError("No se pudo exportar el historial. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="row g-2">
        <div className="col-6">
          <label className="form-label small mb-1" htmlFor="export-from">
            Desde
          </label>
          <select id="export-from" className="form-select form-select-sm" value={from} onChange={(e) => setFrom(e.target.value)}>
            {options.map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6">
          <label className="form-label small mb-1" htmlFor="export-to">
            Hasta
          </label>
          <select id="export-to" className="form-select form-select-sm" value={to} onChange={(e) => setTo(e.target.value)}>
            {options.map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <div className="text-danger small mt-2">{error}</div>}
      <button className="btn btn-success w-100 mt-3" onClick={handleExport} disabled={loading}>
        {loading ? (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            Preparando archivo…
          </>
        ) : (
          <>
            <i className="bi bi-file-earmark-excel me-2" aria-hidden="true" />
            Exportar a Excel
          </>
        )}
      </button>
      <p className="small text-muted mt-2 mb-0">
        Un registro por sector y día, con tiempo, volumen y caudal promedio.
      </p>
    </div>
  );
}

export default ExportHistorial;
