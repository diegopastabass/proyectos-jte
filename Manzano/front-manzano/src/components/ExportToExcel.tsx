import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Tipos para el combobox
type ExportDataType =
  | "nivelEstanque1"
  | "nivelEstanque2"
  | "caudal"
  | "horometro"
  | "totalizador";

const EXPORT_OPTIONS = {
  nivelEstanque1: "Nivel Estanque 1",
  nivelEstanque2: "Nivel Estanque 2",
  caudal: "Caudal",
  horometro: "Horómetro",
  totalizador: "Totalizador",
};

const ENDPOINT_MAP: Record<ExportDataType, string> = {
  nivelEstanque1: "nivelestanque1",
  nivelEstanque2: "nivelestanque2",
  caudal: "caudal",
  horometro: "horometro",
  totalizador: "totalizador",
};

function Export() {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] =
    useState<ExportDataType>("nivelEstanque1");

  const handleExport = async () => {
    if (!startDate || !endDate || !exportType) {
      alert("Selecciona fecha de inicio, fin y el tipo de dato a exportar.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = ENDPOINT_MAP[exportType];
      const sheetName = EXPORT_OPTIONS[exportType];

      const apiUrl = `https://app.jteanalytics.cl/zuniga/${endpoint}?fechaInicio=${startDate}&fechaFin=${endDate}`;

      const res = await fetch(apiUrl);

      if (!res.ok) {
        throw new Error(`Error HTTP: ${res.status}`);
      }

      const data = await res.json();

      if (!data || data.length === 0) {
        alert("No se encontraron datos para el rango de fechas y selección.");
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileName = `${sheetName}_${startDate}_${endDate}.xlsx`;

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
          onChange={(e) => setExportType(e.target.value as ExportDataType)}
        >
          {/* Mapea las opciones disponibles */}
          {Object.entries(EXPORT_OPTIONS).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
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
