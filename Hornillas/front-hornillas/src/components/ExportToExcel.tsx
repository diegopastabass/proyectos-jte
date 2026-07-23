import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Tipos para el combobox
type ExportDataType =
  | "nivel1"
  | "nivel2"
  | "caudal1"
  | "caudal2"
  | "caudalPozo"
  | "presion1"
  | "presion2"
  | "horometro1"
  | "horometro2"
  | "horometroPozo"
  | "totalizador1"
  | "totalizador2"
  | "totalizadorPozo";

const EXPORT_OPTIONS: Record<ExportDataType, string> = {
  nivel1: "Nivel Estanque 1",
  nivel2: "Nivel Estanque 2",
  caudal1: "Caudal Bomba 1",
  caudal2: "Caudal Bomba 2",
  caudalPozo: "Caudal Pozo",
  presion1: "Presión Bomba 1",
  presion2: "Presión Bomba 2",
  horometro1: "Horómetro Bomba 1",
  horometro2: "Horómetro Bomba 2",
  horometroPozo: "Horómetro Pozo",
  totalizador1: "Totalizador Bomba 1",
  totalizador2: "Totalizador Bomba 2",
  totalizadorPozo: "Totalizador Pozo",
};

const ENDPOINT_MAP: Record<ExportDataType, string> = {
  nivel1: "nivel",
  nivel2: "nivel2",
  caudal1: "caudal",
  caudal2: "caudal2",
  caudalPozo: "caudal_pozo",
  presion1: "presion",
  presion2: "presion2",
  horometro1: "horometro",
  horometro2: "horometro2",
  horometroPozo: "horometro_pozo",
  totalizador1: "totalizador",
  totalizador2: "totalizador2",
  totalizadorPozo: "totalizador_pozo",
};

function Export() {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] =
    useState<ExportDataType>("nivel1");

  const handleExport = async () => {
    if (!startDate || !endDate || !exportType) {
      alert("Selecciona fecha de inicio, fin y el tipo de dato a exportar.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = ENDPOINT_MAP[exportType];
      const sheetName = EXPORT_OPTIONS[exportType];

      const apiUrl = `https://app.jteanalytics.cl/hornillas/${endpoint}?start=${startDate}&end=${endDate}`;

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
