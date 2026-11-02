import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

import { ESTANQUES, POZOS_CON_DATOS, apiUrl, todayInChile } from "../tambo";

// Opciones del combobox: endpoint de la API y parámetro del sensor
interface ExportOption {
  label: string;
  endpoint: string;
  params: Record<string, string>;
  /** Factor por el que se divide el valor que entrega la API. */
  divisor?: number;
}

const EXPORT_OPTIONS: Record<string, ExportOption> = {
  ...Object.fromEntries(
    ESTANQUES.map((e) => [
      `nivel_${e.id}`,
      {
        label: `Nivel ${e.nombre} (${e.unidad})`,
        endpoint: "nivel",
        params: { estanque: e.id },
        divisor: e.divisor,
      },
    ]),
  ),
  ...Object.fromEntries(
    POZOS_CON_DATOS.flatMap((p) => [
      [
        `caudal_${p.id}`,
        {
          label: `Caudal ${p.nombre} (l/s)`,
          endpoint: "caudal",
          params: { pozo: p.id },
          divisor: p.divisorCaudal,
        },
      ],
      [
        `horometro_${p.id}`,
        { label: `Horómetro ${p.nombre}`, endpoint: "horometro", params: { pozo: p.id } },
      ],
    ]),
  ),
};

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
      const { endpoint, params, label, divisor = 1 } = EXPORT_OPTIONS[exportType];
      // Excel limita el nombre de hoja a 31 caracteres
      const sheetName = label.slice(0, 31);

      const res = await fetch(
        apiUrl(endpoint, { ...params, start: startDate, end: endDate }),
      );

      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`);
      }

      const data: { time: string; value: number }[] = (await res.json()).map(
        (d: { time: string; value: number }) => ({ ...d, value: d.value / divisor }),
      );

      if (!data || data.length === 0) {
        alert("No se encontraron datos para el rango de fechas y selección.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileName = `${label}_${startDate}_${endDate}.xlsx`;

      const excelBuffer = XLSX.write(wb, {
        bookType: "xlsx",
        type: "array",
      });
      const blob = new Blob([excelBuffer], {
        type: "application/octet-stream",
      });

      saveAs(blob, fileName);
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
          {/* Mapea las opciones disponibles */}
          {Object.entries(EXPORT_OPTIONS).map(([key, option]) => (
            <option key={key} value={key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Fecha inicio */}
      <div className="mb-2">
        <label className="form-label">Fecha inicio</label>
        <input
          type="date"
          className="form-control"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>

      {/* Fecha fin */}
      <div className="mb-2">
        <label className="form-label">Fecha fin</label>
        <input
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
