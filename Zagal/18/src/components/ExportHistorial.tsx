import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function ExportHistorial() {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const [startMonth, setStartMonth] = useState(String(currentMonth));
  const [startYear, setStartYear] = useState(String(currentYear));
  const [endMonth, setEndMonth] = useState(String(currentMonth));
  const [endYear, setEndYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!startMonth || !startYear || !endMonth || !endYear) {
      alert("Selecciona mes y año de inicio y fin.");
      return;
    }

    const formattedStartDate = `${startYear}-${String(startMonth).padStart(
      2,
      "0"
    )}-01`;
    const formattedEndDate = `${endYear}-${String(endMonth).padStart(
      2,
      "0"
    )}-28`;

    try {
      setLoading(true);
      const res = await fetch(
        `https://app.jteanalytics.cl/zagal/18/summary?startDate=${formattedStartDate}&endDate=${formattedEndDate}`
      );
      const data = await res.json();

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial");

      const fileName = `historialRiego${startMonth}${startYear}-${endMonth}${endYear}.xlsx`;

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
      alert("Hubo un error al exportar el historial.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3">
      {/* Fecha inicio */}
      <div className="mb-2">
        <label className="form-label">Fecha inicio</label>
        <div className="d-flex gap-2">
          <select
            className="form-select"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
          >
            <option value="">Mes</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString("es", { month: "long" })}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="form-control"
            placeholder="Año"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
          />
        </div>
      </div>

      {/* Fecha fin */}
      <div className="mb-2">
        <label className="form-label">Fecha fin</label>
        <div className="d-flex gap-2">
          <select
            className="form-select"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
          >
            <option value="">Mes</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(0, i).toLocaleString("es", { month: "long" })}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="form-control"
            placeholder="Año"
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
          />
        </div>
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

export default ExportHistorial;
