import { useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function ExportHistorial() {
  const today = new Date().toISOString().split("T")[0]; // yyyy-mm-dd
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      alert("Selecciona fecha de inicio y fin.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `https://app.jteanalytics.cl/viveros/data?startDate=${startDate}&endDate=${endDate}`
      );
      const data = await res.json();

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Historial");

      const fileName = `datosCamarasViverosTambo_${startDate}_${endDate}.xlsx`;

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

export default ExportHistorial;
