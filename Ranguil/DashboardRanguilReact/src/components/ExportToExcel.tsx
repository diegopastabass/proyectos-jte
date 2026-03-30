import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

type ExportDataType =
  | "nivel"
  | "nivel2"
  | "caudal"
  | "horometro"
  | "totalizador";

const EXPORT_OPTIONS: Record<ExportDataType, string> = {
  nivel: "Nivel Estanque 1",
  nivel2: "Nivel Estanque 2",
  caudal: "Caudal",
  horometro: "Horómetro",
  totalizador: "Totalizador",
};

const ENDPOINT_MAP: Record<ExportDataType, string> = {
  nivel: "nivel",
  nivel2: "nivel2",
  caudal: "caudal",
  horometro: "horometro",
  totalizador: "totalizador",
};

interface ApiDataPoint {
  time: string;
  value: number;
}

type FormattedRow = Record<string, string | number>;

function Export() {
  const today = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [exportType, setExportType] = useState<ExportDataType>("nivel");

  const handleExport = async (): Promise<void> => {
    if (!startDate || !endDate || !exportType) {
      alert("Selecciona fecha de inicio, fin y el tipo de dato a exportar.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = ENDPOINT_MAP[exportType];
      const sheetName = EXPORT_OPTIONS[exportType];
      let apiUrl = "";

      if (
        startDate === endDate &&
        ["nivel", "caudal", "nivel2"].includes(endpoint)
      ) {
        apiUrl = `https://app.jteanalytics.cl/ranguil/${endpoint}`;
      } else {
        apiUrl = `https://app.jteanalytics.cl/ranguil/${endpoint}?start=${startDate}&end=${endDate}`;
      }

      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

      const data: ApiDataPoint[] = await res.json();
      if (data.length === 0) {
        alert("No se encontraron datos para el rango de fechas y selección.");
        return;
      }

      const formattedData: FormattedRow[] = data.map((d): FormattedRow => {
        const date = new Date(d.time);
        const fecha = date.toLocaleDateString("es-CL");
        const hora = date.toLocaleTimeString("es-CL", {
          hour: "2-digit",
          minute: "2-digit",
        });

        switch (exportType) {
          case "nivel":
            return {
              Fecha: fecha,
              Hora: hora,
              "Valor (m)": (d.value / 100).toFixed(2),
            };
          case "nivel2":
            return {
              Fecha: fecha,
              Hora: hora,
              "Valor (m)": d.value.toFixed(2),
            };
          case "caudal":
            return {
              Fecha: fecha,
              Hora: hora,
              "Valor (l/s)": d.value.toFixed(2),
            };
          case "horometro": {
            const totalMin = d.value;
            const horas = Math.floor(totalMin / 60);
            const minutos = totalMin % 60;

            const hhmm = `${String(horas).padStart(2, "0")}:${String(
              minutos,
            ).padStart(2, "0")}`;

            return {
              Fecha: fecha,
              "Valor (HH:MM)": hhmm,
            };
          }

          case "totalizador":
            return { Fecha: fecha, "Valor (m³)": d.value };
        }
      });

      const ws = XLSX.utils.json_to_sheet(formattedData);

      const colWidths = Object.keys(formattedData[0]).map((key) => ({
        wch:
          Math.max(
            key.length,
            ...formattedData.map((row) => row[key]?.toString().length ?? 0),
          ) + 2,
      }));
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const fileName = `${sheetName}_${startDate}_${endDate}.xlsx`;
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], {
        type: "application/octet-stream",
      });

      saveAs(blob, fileName);
    } catch (err) {
      console.error("Error exportando historial:", err);
      const message = err instanceof Error ? err.message : "Error desconocido";
      alert(`Hubo un error al exportar el historial. Detalle: ${message}`);
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
