import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Card from "./Card";
import type { DailyRow } from "../types";
import { I_UNBALANCE_WARN, V_UNBALANCE_WARN } from "../lib/electrical";
import { minutesToHHMM } from "../lib/time";

interface DailySummaryTableProps {
  rows: DailyRow[];
}

const fmt = (x: number | null, d = 1) => (x === null ? "—" : x.toFixed(d));

function DailySummaryTable({ rows }: DailySummaryTableProps) {
  const exportXlsx = () => {
    const sheet = rows.map((r) => ({
      Fecha: r.date,
      "Horas operación": minutesToHHMM(r.horas * 60),
      "Volumen (m³)": Number(r.m3.toFixed(2)),
      "Energía (kWh)": Number(r.kwh.toFixed(2)),
      "kWh/m³": r.kwhPorM3 === null ? "" : Number(r.kwhPorM3.toFixed(3)),
      "Costo ($)": Math.round(r.costo),
      Arranques: r.arranques,
      "Desbalance corriente (%)": r.desbalanceI === null ? "" : Number(r.desbalanceI.toFixed(1)),
      "Desbalance tensión (%)": r.desbalanceV === null ? "" : Number(r.desbalanceV.toFixed(2)),
      "FP implícito": r.fpImplicito === null ? "" : Number(r.fpImplicito.toFixed(2)),
    }));
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resumen eléctrico");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buffer], { type: "application/octet-stream" }),
      "Resumen_electrico_diario.xlsx",
    );
  };

  return (
    <Card className="panel">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div className="panel-title mb-0">
          <i className="bi bi-table me-1"></i>Resumen diario
        </div>
        <button className="btn btn-sm btn-outline-success" onClick={exportXlsx}>
          <i className="bi bi-file-earmark-excel me-1"></i>Excel
        </button>
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>Fecha</th>
              <th className="text-end">Horas</th>
              <th className="text-end">m³</th>
              <th className="text-end">kWh</th>
              <th className="text-end">kWh/m³</th>
              <th className="text-end">Costo</th>
              <th className="text-end">Arranques</th>
              <th className="text-end">Desb. I</th>
              <th className="text-end">Desb. V</th>
              <th className="text-end">FP impl.</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <tr key={r.date}>
                <td>{r.date}</td>
                <td className="text-end">{minutesToHHMM(r.horas * 60)}</td>
                <td className="text-end">{r.m3.toFixed(1)}</td>
                <td className="text-end">{r.kwh.toFixed(1)}</td>
                <td className="text-end">{fmt(r.kwhPorM3, 3)}</td>
                <td className="text-end">${Math.round(r.costo).toLocaleString("es-CL")}</td>
                <td className="text-end">{r.arranques}</td>
                <td
                  className={`text-end ${r.desbalanceI !== null && r.desbalanceI > I_UNBALANCE_WARN ? "sev-warn fw-semibold" : ""}`}
                >
                  {fmt(r.desbalanceI)} %
                </td>
                <td
                  className={`text-end ${r.desbalanceV !== null && r.desbalanceV > V_UNBALANCE_WARN ? "sev-warn fw-semibold" : ""}`}
                >
                  {fmt(r.desbalanceV, 2)} %
                </td>
                <td className="text-end">{fmt(r.fpImplicito, 2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="small text-body-secondary mt-2">
        Desbalances: percentil 95 de la jornada (en operación para corriente). FP implícito = energía del medidor / energía aparente calculada con V·I (solo días con datos completos).
      </div>
    </Card>
  );
}

export default DailySummaryTable;
