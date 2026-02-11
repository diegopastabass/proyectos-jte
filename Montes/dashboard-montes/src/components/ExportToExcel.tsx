// src/components/ExportToExcel.tsx
import { useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Button, Form, Row, Col, Spinner } from "react-bootstrap";

export interface Metric {
  value: number;
  time: string;
}

// 1. Agregamos las nuevas opciones para el reporte por hora
type ExportOption =
  | "montes_riles_totalizador"
  | "montes_riles_totalizador_hora" // Nuevo
  | "montes_riles_caudal"
  | "montes_general_totalizador"
  | "montes_general_totalizador_hora" // Nuevo
  | "montes_general_caudal";

const EXPORT_LABELS: Record<ExportOption, string> = {
  montes_riles_totalizador: "Riles - Totalizador Diario",
  montes_riles_totalizador_hora: "Riles - Totalizador por Hora", // Etiqueta Nueva
  montes_riles_caudal: "Riles - Caudal Histórico",
  montes_general_totalizador: "General - Totalizador Diario",
  montes_general_totalizador_hora: "General - Totalizador por Hora", // Etiqueta Nueva
  montes_general_caudal: "General - Caudal Histórico",
};

interface ExportToExcelProps {
  onClose?: () => void;
}

export default function ExportToExcel({ onClose }: ExportToExcelProps) {
  const [selectedOption, setSelectedOption] = useState<ExportOption>(
    "montes_riles_totalizador",
  );
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const fetchMetrics = async (
    option: ExportOption,
    start: string,
    end: string,
  ): Promise<Metric[]> => {
    let url = "";
    const baseUrl = "https://app.jteanalytics.cl/montes/";

    switch (option) {
      // --- RILES ---
      case "montes_riles_totalizador":
        url = `${baseUrl}/totalizador/montes_riles_totalizador?start=${start}&end=${end}`;
        break;
      case "montes_riles_totalizador_hora":
        url = `${baseUrl}/totalizador-hora/montes_riles_totalizador?start=${start}&end=${end}`;
        break;
      case "montes_riles_caudal":
        url = `${baseUrl}/caudal/montes_riles_caudal?start=${start}&end=${end}`;
        break;

      // --- GENERAL ---
      case "montes_general_totalizador":
        url = `${baseUrl}/totalizador/montes_general_totalizador?start=${start}&end=${end}`;
        break;
      case "montes_general_totalizador_hora":
        url = `${baseUrl}/totalizador-hora/montes_general_totalizador?start=${start}&end=${end}`;
        break;
      case "montes_general_caudal":
        url = `${baseUrl}/caudal/montes_general_caudal?start=${start}&end=${end}`;
        break;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error al obtener datos desde el servidor.`);
    }
    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("El servidor no devolvió un arreglo válido.");
    }

    const isMetricArray = (arr: unknown[]): arr is Metric[] =>
      arr.every(
        (item) =>
          typeof item === "object" &&
          item !== null &&
          "time" in item &&
          "value" in item,
      );

    if (!isMetricArray(data)) {
      throw new Error("Los datos no tienen el formato esperado (value, time).");
    }

    return data;
  };

  const handleExport = async (): Promise<void> => {
    if (!startDate || !endDate) {
      alert("Por favor selecciona ambas fechas antes de exportar.");
      return;
    }

    setLoading(true);
    try {
      const data = await fetchMetrics(selectedOption, startDate, endDate);

      if (data.length === 0) {
        alert("No se encontraron datos para el rango seleccionado.");
        return;
      }

      const isTotalizador = selectedOption.includes("totalizador");
      const unitLabel = isTotalizador ? "m³" : "L/s";

      const worksheetData: (string | number)[][] = [
        [EXPORT_LABELS[selectedOption]],
        ["Fecha", "Hora", "Valor", "Unidad"],
        ...data.map((item) => {
          const dateObj = new Date(item.time);
          const dateStr = dateObj.toISOString().split("T")[0];
          const timeStr = dateObj.toLocaleTimeString("es-CL", {
            hour12: false,
          });

          return [dateStr, timeStr, item.value, unitLabel];
        }),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");

      worksheet["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 8 }];

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const filename = `${selectedOption}_${startDate}_${endDate}.xlsx`;
      saveAs(blob, filename);
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("Ocurrió un error desconocido al exportar los datos.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedOption(e.target.value as ExportOption);
  };

  const handleStartDateChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setEndDate(e.target.value);
  };

  return (
    <div className="p-3">
      <Form>
        <Form.Group as={Row} className="mb-3" controlId="selectorReporte">
          <Form.Label column sm="4">
            Seleccionar reporte:
          </Form.Label>
          <Col sm="8">
            <Form.Select value={selectedOption} onChange={handleSelectChange}>
              <option value="montes_riles_totalizador">
                {EXPORT_LABELS["montes_riles_totalizador"]}
              </option>
              <option value="montes_riles_totalizador_hora">
                {EXPORT_LABELS["montes_riles_totalizador_hora"]}
              </option>
              <option value="montes_riles_caudal">
                {EXPORT_LABELS["montes_riles_caudal"]}
              </option>
              <hr />
              <option value="montes_general_totalizador">
                {EXPORT_LABELS["montes_general_totalizador"]}
              </option>
              <option value="montes_general_totalizador_hora">
                {EXPORT_LABELS["montes_general_totalizador_hora"]}
              </option>
              <option value="montes_general_caudal">
                {EXPORT_LABELS["montes_general_caudal"]}
              </option>
            </Form.Select>
          </Col>
        </Form.Group>

        <Row className="mb-3">
          <Col>
            <Form.Label>Fecha inicio:</Form.Label>
            <Form.Control
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
            />
          </Col>
          <Col>
            <Form.Label>Fecha fin:</Form.Label>
            <Form.Control
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
            />
          </Col>
        </Row>

        <div className="d-flex justify-content-end mt-4">
          <Button
            variant="secondary"
            className="me-2"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button variant="success" onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />{" "}
                Exportando...
              </>
            ) : (
              "Exportar a Excel"
            )}
          </Button>
        </div>
      </Form>
    </div>
  );
}
