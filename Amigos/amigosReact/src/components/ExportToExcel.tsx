// src/components/ExportToExcel.tsx
import { useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Button, Form, Row, Col, Spinner } from "react-bootstrap";

export interface Metric {
  value: number;
  time: string;
}

type ExportOption = "totalizador" | "nivel" | "caudal";

const EXPORT_LABELS: Record<ExportOption, string> = {
  "totalizador": "Totalizador",
  "nivel": "Nivel",
  "caudal": "Caudal Instantáneo",
};

interface ExportToExcelProps {
  onClose?: () => void;
}

export default function ExportToExcel({ onClose }: ExportToExcelProps) {
  const [selectedOption, setSelectedOption] =
    useState<ExportOption>("totalizador");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const fetchMetrics = async (
    option: ExportOption,
    start: string,
    end: string
  ): Promise<Metric[]> => {
    const url = `https://app.jteanalytics.cl/amigos/${option}?startDate=${start}&endDate=${end}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error al obtener datos desde ${url}`);
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
          "value" in item &&
          typeof (item as Metric).time === "string" &&
          typeof (item as Metric).value === "number"
      );

    if (!isMetricArray(data)) {
      throw new Error("Los datos no tienen el formato esperado de Metric[].");
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

      const worksheetData: (string | number)[][] = [
        [EXPORT_LABELS[selectedOption]],
        ["Fecha", "Valor", "Unidad"],
        ...data.map((item) => {
          const date = new Date(item.time);
          const formattedDate = date.toISOString().split("T")[0];
          const unidad =
            selectedOption === "nivel"
              ? "m"
              : selectedOption === "caudal"
              ? "l/s"
              : "m³";
          return [formattedDate, item.value / 10, unidad];
        }),
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");

      worksheet["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 8 }];

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const filename = `${selectedOption}_${startDate}_a_${endDate}.xlsx`;
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
        <Form.Group as={Row} className="mb-3" controlId="selectorTotalizador">
          <Form.Label column sm="4">
            Seleccionar totalizador:
          </Form.Label>
          <Col sm="8">
            <Form.Select value={selectedOption} onChange={handleSelectChange}>
              <option value="totalizador">Totalizador</option>
              <option value="nivel">Nivel</option>
              <option value="caudal">Caudal Instantáneo</option>
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
