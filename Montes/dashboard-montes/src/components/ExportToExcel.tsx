// src/components/ExportToExcel.tsx
import { useState } from "react";
import { Alert, Button, ButtonGroup, Col, Form, Row, Spinner } from "react-bootstrap";
import { LINEAS, ORDEN_LINEAS, type LineaId } from "../config";
import { conRango, getDiario, getSerie } from "../lib/api";
import { diaChile, horaChile, hoyChile, listarDias, sumarDias } from "../lib/fechas";
import type { Punto } from "./types";

type TipoReporte = "diario" | "hora" | "caudal";
type Reporte = "todo" | `${LineaId}_${TipoReporte}`;

const TIPOS: Record<TipoReporte, string> = {
  diario: "Consumo diario",
  hora: "Consumo por hora",
  caudal: "Caudal (lecturas)",
};

type Fila = (string | number | null)[];

interface Hoja {
  nombre: string;
  titulo: string;
  columnas: string[];
  filas: Fila[];
  anchos: number[];
}

const fechaDe = (p: Punto) => diaChile(p.time);

async function hojaDe(linea: LineaId, tipo: TipoReporte, start: string, end: string): Promise<Hoja> {
  const { nombre, caudal, totalizador } = LINEAS[linea];
  const titulo = `${nombre} · ${TIPOS[tipo]}`;
  if (tipo === "diario") {
    const datos = await getDiario(totalizador, start, end);
    return {
      nombre: `Diario ${nombre}`,
      titulo,
      columnas: ["Fecha", "Consumo (m³)"],
      filas: datos.map((p) => [p.time, p.value]),
      anchos: [12, 14],
    };
  }
  if (tipo === "hora") {
    const datos = await getSerie(conRango(`totalizador-hora/${totalizador}`, start, end));
    return {
      nombre: `Hora ${nombre}`,
      titulo: `${titulo} (totalizador)`,
      columnas: ["Fecha", "Hora", "Consumo (m³)"],
      filas: datos.map((p) => [fechaDe(p), horaChile(p.time), p.value]),
      anchos: [12, 8, 14],
    };
  }
  const datos = await getSerie(conRango(`caudal/${caudal}`, start, end));
  return {
    nombre: `Caudal ${nombre}`,
    titulo,
    columnas: ["Fecha", "Hora", "Caudal (m³/h)"],
    filas: datos.map((p) => [fechaDe(p), horaChile(p.time), p.value]),
    anchos: [12, 8, 14],
  };
}

/** Consumo diario de ambas líneas lado a lado. */
async function hojaResumen(start: string, end: string): Promise<Hoja> {
  const [general, riles] = await Promise.all(
    ORDEN_LINEAS.map((id) => getDiario(LINEAS[id].totalizador, start, end)),
  );
  const g = new Map(general.map((p) => [p.time, p.value]));
  const r = new Map(riles.map((p) => [p.time, p.value]));
  return {
    nombre: "Resumen diario",
    titulo: "Consumo diario · General y Riles",
    columnas: ["Fecha", "General (m³)", "Riles (m³)"],
    filas: listarDias(start, end)
      .filter((d) => g.has(d) || r.has(d))
      .map((d) => [d, g.get(d) ?? null, r.get(d) ?? null]),
    anchos: [12, 14, 14],
  };
}

async function descargarLibro(hojas: Hoja[], start: string, end: string, archivo: string) {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  libro.creator = "JTE Analytics";

  for (const hoja of hojas) {
    const ws = libro.addWorksheet(hoja.nombre);
    ws.addRow([hoja.titulo]).font = { bold: true, size: 13 };
    ws.addRow([`Viña Montes · del ${start} al ${end} (hora Chile)`]).font = { italic: true };
    ws.addRow([]);
    ws.addRow(hoja.columnas).font = { bold: true };
    ws.addRows(hoja.filas);
    ws.columns = hoja.anchos.map((width) => ({ width }));
    ws.views = [{ state: "frozen", ySplit: 4 }];
  }

  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = archivo;
  a.click();
  URL.revokeObjectURL(url);
}

const ATAJOS: { etiqueta: string; rango: (hoy: string) => [string, string] }[] = [
  { etiqueta: "Hoy", rango: (hoy) => [hoy, hoy] },
  { etiqueta: "7 días", rango: (hoy) => [sumarDias(hoy, -6), hoy] },
  { etiqueta: "Mes actual", rango: (hoy) => [`${hoy.slice(0, 7)}-01`, hoy] },
  {
    etiqueta: "Mes anterior",
    rango: (hoy) => {
      const fin = sumarDias(`${hoy.slice(0, 7)}-01`, -1);
      return [`${fin.slice(0, 7)}-01`, fin];
    },
  },
];

interface ExportToExcelProps {
  onClose?: () => void;
}

export default function ExportToExcel({ onClose }: ExportToExcelProps) {
  const hoy = hoyChile();
  const [reporte, setReporte] = useState<Reporte>("todo");
  const [startDate, setStartDate] = useState(sumarDias(hoy, -6));
  const [endDate, setEndDate] = useState(hoy);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "danger" | "info"; texto: string } | null>(null);

  const handleExport = async () => {
    if (!startDate || !endDate) {
      setMensaje({ tipo: "danger", texto: "Selecciona ambas fechas." });
      return;
    }
    if (startDate > endDate) {
      setMensaje({ tipo: "danger", texto: "La fecha de inicio debe ser anterior o igual a la de fin." });
      return;
    }

    setMensaje(null);
    setLoading(true);
    try {
      let hojas: Hoja[];
      if (reporte === "todo") {
        hojas = [
          await hojaResumen(startDate, endDate),
          ...(await Promise.all(
            ORDEN_LINEAS.flatMap((id) =>
              (["hora", "caudal"] as const).map((tipo) => hojaDe(id, tipo, startDate, endDate)),
            ),
          )),
        ];
      } else {
        const [linea, tipo] = reporte.split("_") as [LineaId, TipoReporte];
        hojas = [await hojaDe(linea, tipo, startDate, endDate)];
      }

      if (hojas.every((h) => h.filas.length === 0)) {
        setMensaje({ tipo: "info", texto: "No hay datos para el rango seleccionado." });
        return;
      }
      await descargarLibro(hojas, startDate, endDate, `montes_${reporte}_${startDate}_${endDate}.xlsx`);
    } catch (error) {
      setMensaje({
        tipo: "danger",
        texto: error instanceof Error ? error.message : "Ocurrió un error al exportar los datos.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form onSubmit={(e) => e.preventDefault()}>
      <Form.Group className="mb-3" controlId="selectorReporte">
        <Form.Label>Reporte</Form.Label>
        <Form.Select value={reporte} onChange={(e) => setReporte(e.target.value as Reporte)}>
          <option value="todo">Todo (resumen diario, consumo por hora y caudal)</option>
          {ORDEN_LINEAS.map((id) => (
            <optgroup key={id} label={LINEAS[id].nombre}>
              {(Object.keys(TIPOS) as TipoReporte[]).map((tipo) => (
                <option key={tipo} value={`${id}_${tipo}`}>
                  {LINEAS[id].nombre} · {TIPOS[tipo]}
                </option>
              ))}
            </optgroup>
          ))}
        </Form.Select>
      </Form.Group>

      <ButtonGroup size="sm" className="mb-3 flex-wrap" aria-label="Rangos rápidos">
        {ATAJOS.map(({ etiqueta, rango }) => (
          <Button
            key={etiqueta}
            variant="outline-secondary"
            onClick={() => {
              const [s, e] = rango(hoy);
              setStartDate(s);
              setEndDate(e);
            }}
          >
            {etiqueta}
          </Button>
        ))}
      </ButtonGroup>

      <Row className="mb-3">
        <Col>
          <Form.Label htmlFor="exportInicio">Desde</Form.Label>
          <Form.Control
            id="exportInicio"
            type="date"
            value={startDate}
            max={hoy}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </Col>
        <Col>
          <Form.Label htmlFor="exportFin">Hasta</Form.Label>
          <Form.Control
            id="exportFin"
            type="date"
            value={endDate}
            max={hoy}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Col>
      </Row>

      {mensaje && (
        <Alert variant={mensaje.tipo} className="py-2">
          {mensaje.texto}
        </Alert>
      )}

      <div className="d-flex justify-content-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="success" onClick={handleExport} disabled={loading}>
          {loading ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" />
              Exportando...
            </>
          ) : (
            "Exportar a Excel"
          )}
        </Button>
      </div>
    </Form>
  );
}
