import { useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { PDFCumulativeReport } from "./PDFCumulativeReport";
import Navbar from "./Navbar";
import { type User } from "../types";
import { saveAs } from "file-saver";

interface Props {
  user: User;
  onLogout: () => void;
  onBack: () => void;
}

export default function ExportReports({ user, onLogout, onBack }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const fetchAndProcessData = async () => {
    if (!startDate || !endDate) return alert("Seleccione ambas fechas");
    setLoading(true);

    try {
      const token = localStorage.getItem("user_token");
      const res = await axios.get(
        `https://app.jteanalytics.cl/zuniga-mediciones/sessions/export?start=${startDate}&end=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const rawData = res.data; // Array de measurements

      const grouped: Record<string, any> = {};

      rawData.forEach((m: any) => {
        const key = m.time; // O m.session.id si prefieres
        if (!grouped[key]) {
          grouped[key] = { time: key };
        }

        // Mapeo de nombres genéricos a columnas específicas
        const name = m.name.toLowerCase();
        if (name.includes("horómetro")) grouped[key].horometro = m.value;
        if (name.includes("caudalímetro")) grouped[key].caudalimetro = m.value;
        if (name.includes("energía")) grouped[key].energia = m.value;
        if (name.includes("estático")) grouped[key].estatico = m.value;
        if (name.includes("dinámico")) grouped[key].dinamico = m.value;
        if (name.includes("cloro en caseta") || name.includes("cloro en bomba"))
          grouped[key].cloroBomba = m.value;
        if (name.includes("punto 1")) grouped[key].cloroRed1 = m.value;
        if (name.includes("punto 2")) grouped[key].cloroRed2 = m.value;
      });

      // Convertir a array y ordenar
      const rows = Object.values(grouped).sort(
        (a: any, b: any) =>
          new Date(a.time).getTime() - new Date(b.time).getTime(),
      );

      setProcessedData(rows);
      calculateBalances(rows);
    } catch (error) {
      console.error(error);
      alert("Error obteniendo datos");
    } finally {
      setLoading(false);
    }
  };

  const calculateBalances = (rows: any[]) => {
    if (rows.length === 0) {
      setStats(null);
      return;
    }

    const first = rows[0];
    const last = rows[rows.length - 1];

    const getDiff = (key: string) =>
      ((last[key] || 0) - (first[key] || 0)).toFixed(2);

    const sum = (key: string) =>
      rows.reduce((acc, curr) => acc + (curr[key] || 0), 0);
    const count = (key: string) =>
      rows.filter((r) => r[key] !== undefined).length;
    const avg = (key: string) => {
      const c = count(key);
      return c > 0 ? (sum(key) / c).toFixed(2) : 0;
    };

    const statsObj = {
      horometroTotal: getDiff("horometro"),
      caudalimetroFin: getDiff("caudalimetro"),
      energiaProm: getDiff("energia"),
      estaticoProm: avg("estatico"),
      dinamicoProm: avg("dinamico"),
      cloroBombaProm: avg("cloroBomba"),
      cloroRed1Prom: avg("cloroRed1"),
      cloroRed2Prom: avg("cloroRed2"),
    };

    setStats(statsObj);
  };

  const exportExcel = () => {
    // Preparar datos para Excel
    const excelRows = processedData.map((r) => ({
      Fecha: new Date(r.time).toLocaleString(),
      Horómetro: r.horometro,
      Caudalímetro: r.caudalimetro,
      Energía: r.energia,
      "Nivel Estático": r.estatico,
      "Nivel Dinámico": r.dinamico,
      "Cloro Caseta": r.cloroBomba,
      "Cloro Red 1": r.cloroRed1,
      "Cloro Red 2": r.cloroRed2,
    }));

    // Agregar filas de balance al final
    excelRows.push({
      Fecha: "",
      Horómetro: undefined,
      Caudalímetro: undefined,
      Energía: undefined,
      "Nivel Estático": undefined,
      "Nivel Dinámico": undefined,
      "Cloro Caseta": undefined,
      "Cloro Red 1": undefined,
      "Cloro Red 2": undefined,
    }); // Espacio
    excelRows.push({
      Fecha: "BALANCES DEL PERÍODO",
      Horómetro: undefined,
      Caudalímetro: undefined,
      Energía: undefined,
      "Nivel Estático": undefined,
      "Nivel Dinámico": undefined,
      "Cloro Caseta": undefined,
      "Cloro Red 1": undefined,
      "Cloro Red 2": undefined,
    });
    excelRows.push({
      Fecha: "Horómetro Total",
      Horómetro: stats.horometroTotal,
      Caudalímetro: undefined,
      Energía: undefined,
      "Nivel Estático": undefined,
      "Nivel Dinámico": undefined,
      "Cloro Caseta": undefined,
      "Cloro Red 1": undefined,
      "Cloro Red 2": undefined,
    });
    excelRows.push({
      Fecha: "Caudalímetro (Último)",
      Caudalímetro: stats.caudalimetroFin,
      Horómetro: undefined,
      Energía: undefined,
      "Nivel Estático": undefined,
      "Nivel Dinámico": undefined,
      "Cloro Caseta": undefined,
      "Cloro Red 1": undefined,
      "Cloro Red 2": undefined,
    });
    excelRows.push({
      Fecha: "Promedios",
      Energía: stats.energiaProm,
      "Nivel Estático": stats.estaticoProm,
      "Nivel Dinámico": stats.dinamicoProm,
      "Cloro Caseta": stats.cloroBombaProm,
      Horómetro: undefined,
      Caudalímetro: undefined,
      "Cloro Red 1": undefined,
      "Cloro Red 2": undefined,
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Producción Acumulada");
    XLSX.writeFile(wb, `Reporte_Acumulado_${startDate}_${endDate}.xlsx`);
  };

  const exportPDF = async () => {
    setLoading(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const blob = await pdf(
        <PDFCumulativeReport
          data={processedData}
          stats={stats}
          range={{ start: startDate, end: endDate }}
        />,
      ).toBlob();

      saveAs(blob, `Reporte_Acumulado_${startDate}_${endDate}.pdf`);
    } catch (error) {
      console.error("Error generando PDF:", error);
      alert("Hubo un error al generar el archivo PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar user={user} onLogout={onLogout} />
      <div className="container py-4">
        <div className="d-flex align-items-center mb-4">
          <button className="btn btn-outline-secondary me-3" onClick={onBack}>
            <i className="bi bi-arrow-left"></i> Volver
          </button>
          <h3>Exportación de Datos y Balances</h3>
        </div>

        <div className="card p-4 shadow-sm mb-4">
          <div className="row align-items-end">
            <div className="col-md-4">
              <label className="form-label">Fecha Inicio</label>
              <input
                type="date"
                className="form-control"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Fecha Fin</label>
              <input
                type="date"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <button
                className="btn btn-primary w-100"
                onClick={fetchAndProcessData}
                disabled={loading}
              >
                {loading ? "Cargando..." : "Generar Tabla"}
              </button>
            </div>
          </div>
        </div>

        {processedData.length > 0 && (
          <>
            <div className="d-flex justify-content-end gap-2 mb-3">
              <button className="btn btn-success" onClick={exportExcel}>
                <i className="bi bi-file-earmark-excel me-2"></i> Exportar Excel
              </button>
              <button className="btn btn-danger" onClick={exportPDF}>
                <i className="bi bi-file-earmark-pdf me-2"></i> Exportar PDF
              </button>
            </div>

            {/* Tabla de Vista Previa */}
            <div
              className="table-responsive bg-white shadow-sm rounded mb-4"
              style={{ maxHeight: "500px" }}
            >
              <table
                className="table table-hover table-bordered mb-0 text-center table-sm"
                style={{ fontSize: "0.9rem" }}
              >
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Fecha</th>
                    <th>Horómetro</th>
                    <th>Caudal (m³)</th>
                    <th>Energía</th>
                    <th>N. Est.</th>
                    <th>N. Din.</th>
                    <th>Cl. Caseta</th>
                    <th>Cl. Red 1</th>
                    <th>Cl. Red 2</th>
                  </tr>
                </thead>
                <tbody>
                  {processedData.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        {new Date(row.time).toLocaleDateString()}{" "}
                        {new Date(row.time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>{row.horometro}</td>
                      <td>{row.caudalimetro}</td>
                      <td>{row.energia}</td>
                      <td>{row.estatico}</td>
                      <td>{row.dinamico}</td>
                      <td>{row.cloroBomba}</td>
                      <td>{row.cloroRed1}</td>
                      <td>{row.cloroRed2}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sección de Balances */}
            {stats && (
              <div className="card shadow-sm border-primary">
                <div className="card-header bg-primary text-white fw-bold">
                  Balances del Período
                </div>
                <div className="card-body">
                  <div className="row text-center">
                    <div className="col-md-3 mb-3">
                      <div className="text-muted small">Horómetro </div>
                      <div className="fs-5 fw-bold">{stats.horometroTotal}</div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="text-muted small">Caudalímetro</div>
                      <div className="fs-5 fw-bold">
                        {stats.caudalimetroFin}
                      </div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="text-muted small">Energía.</div>
                      <div className="fs-5 fw-bold">
                        {stats.energiaProm} kWh
                      </div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="text-muted small">
                        Nivel Estático Prom.
                      </div>
                      <div className="fs-5 fw-bold">{stats.estaticoProm} m</div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="text-muted small">
                        Nivel Dinámico Prom.
                      </div>
                      <div className="fs-5 fw-bold">{stats.dinamicoProm} m</div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="text-muted small">Cloro Caseta Prom.</div>
                      <div className="fs-5 fw-bold">
                        {stats.cloroBombaProm} ppm
                      </div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="text-muted small">Cloro Red 1 Prom.</div>
                      <div className="fs-5 fw-bold">
                        {stats.cloroRed1Prom} ppm
                      </div>
                    </div>
                    <div className="col-md-3 mb-3">
                      <div className="text-muted small">Cloro Red 2 Prom.</div>
                      <div className="fs-5 fw-bold">
                        {stats.cloroRed2Prom} ppm
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
