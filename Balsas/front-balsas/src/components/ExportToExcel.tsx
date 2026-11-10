import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { POZOS, apiUrl, todayInChile, type Metric, type MultiSeries } from "../balsas";

// Opciones del combobox: endpoint de la API y parámetros del sensor
interface ExportOption {
  label: string;
  endpoint: string;
  params?: Record<string, string>;
}

const EXPORT_OPTIONS: Record<string, ExportOption> = {
  nivel: { label: "Nivel Estanque (m)", endpoint: "nivel" },
  caudal: { label: "Caudal Impulsión (l/s)", endpoint: "caudal" },
  presion: { label: "Presión (bar)", endpoint: "presion" },
  caudal_descarga: { label: "Caudal Descarga (l/s)", endpoint: "caudal_descarga" },
  solar: { label: "Voltaje Panel Solar (V)", endpoint: "solar" },
  totalizador: { label: "Totalizador Impulsión Diario (m³)", endpoint: "totalizador" },
  totalizador_descarga: { label: "Totalizador Descarga Diario (m³)", endpoint: "totalizador_descarga" },
  ...Object.fromEntries(
    POZOS.flatMap((p) => [
      [`horometro_${p.id}`, { label: `Horómetro ${p.nombre} (min)`, endpoint: "horometro", params: { pozo: p.id } }],
      [`voltaje_${p.id}`, { label: `Voltaje ${p.nombre} (V)`, endpoint: "voltaje", params: { pozo: p.id } }],
      [`corriente_${p.id}`, { label: `Corriente ${p.nombre} (A)`, endpoint: "corriente", params: { pozo: p.id } }],
    ]),
  ),
};

// Las series con hora se exportan en hora de Chile; las diarias ya vienen como AAAA-MM-DD
const horaChile = (time: string) =>
  time.includes("T")
    ? new Date(time).toLocaleString("es-CL", { timeZone: "America/Santiago" })
    : time;

const aFilas = (respuesta: Metric[] | MultiSeries) =>
  Array.isArray(respuesta)
    ? respuesta.map((d) => ({ fecha: horaChile(d.time), valor: d.value }))
    : Object.entries(respuesta).flatMap(([serie, datos]) =>
        datos.map((d) => ({ serie, fecha: horaChile(d.time), valor: d.value })),
      );

function Export() {
  const today = todayInChile();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState(Object.keys(EXPORT_OPTIONS)[0]);

  const handleExport = async () => {
    if (!startDate || !endDate || !exportType) {
      alert("Selecciona fecha de inicio, fin y el tipo de dato a exportar.");
      return;
    }

    setLoading(true);

    try {
      const { endpoint, params, label } = EXPORT_OPTIONS[exportType];
      // Excel limita el nombre de hoja a 31 caracteres y no admite : \ / ? * [ ]
      const nombreSeguro = label.replace(/[:\\/?*[\]]/g, "-");

      const res = await fetch(
        apiUrl(endpoint, { ...params, start: startDate, end: endDate }),
      );

      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`);
      }

      const filas = aFilas(await res.json());

      if (filas.length === 0) {
        alert("No se encontraron datos para el rango de fechas y selección.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(filas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, nombreSeguro.slice(0, 31));

      const excelBuffer = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      });
      const blob = new Blob([excelBuffer], {
        type: "application/octet-stream",
      });

      saveAs(blob, `${nombreSeguro}_${startDate}_${endDate}.xlsx`);
    } catch (err) {
      console.error("Error exportando historial:", err);
      alert(
        `Hubo un error al exportar el historial. Detalle: ${
          err instanceof Error ? err.message : "Error desconocido"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3">
      {/* Selector de Data (Combobox) */}
      <div className="mb-2">
        <label htmlFor="exportTypeSelect" className="form-label">
          Dato a Exportar
        </label>
        <select
          id="exportTypeSelect"
          className="form-select"
          value={exportType}
          onChange={(e) => setExportType(e.target.value)}
        >
          {Object.entries(EXPORT_OPTIONS).map(([key, option]) => (
            <option key={key} value={key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Fecha inicio */}
      <div className="mb-2">
        <label htmlFor="exportStart" className="form-label">Fecha inicio</label>
        <input
          id="exportStart"
          type="date"
          className="form-control"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      {/* Fecha fin */}
      <div className="mb-2">
        <label htmlFor="exportEnd" className="form-label">Fecha fin</label>
        <input
          id="exportEnd"
          type="date"
          className="form-control"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {/* Botón o Spinner */}
      <div className="mt-3">
        {loading ? (
          <div className="d-flex justify-content-center">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        ) : (
          <button className="btn btn-success w-100" onClick={handleExport}>
            Exportar a Excel
          </button>
        )}
      </div>
    </div>
  );
}

export default Export;
