import { useState } from "react";
import { Alert, Button, ButtonGroup, Col, Form, Row, Spinner } from "react-bootstrap";
import { ORDEN_ZONAS, type ZonaId } from "../config";
import { getEpisodios, getResumen, getSerie } from "../lib/api";
import { TEXTO_VALOR, clasificar, porcentajeEnRango } from "../lib/estados";
import { diaChile, horaChile, hoyChile, listarDias, sumarDias } from "../lib/fechas";
import type { PuntoSerie, ZonaConfig } from "../lib/tipos";

type Reporte = "todo" | "resumen" | "episodios" | `lecturas_${ZonaId}`;
type Fila = (string | number | null)[];

interface Hoja {
  nombre: string;
  titulo: string;
  columnas: string[];
  filas: Fila[];
  anchos: number[];
}

/** Con una lectura cada ~2 min, 92 días son ~66.000 filas por zona: el máximo razonable en el navegador. */
const MAX_DIAS_LECTURAS = 92;
const TRAMO_DIAS = 31;

const redondear = (v: number | null | undefined, d = 2) =>
  v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d;

async function lecturasDe(zona: ZonaId, start: string, end: string): Promise<PuntoSerie[]> {
  const tramos: [string, string][] = [];
  for (let d = start; d <= end; d = sumarDias(d, TRAMO_DIAS)) {
    const fin = sumarDias(d, TRAMO_DIAS - 1);
    tramos.push([d, fin < end ? fin : end]);
  }
  const partes = await Promise.all(tramos.map(([s, e]) => getSerie(zona, s, e)));
  return partes.flat();
}

async function hojaLecturas(cfg: ZonaConfig, start: string, end: string): Promise<Hoja> {
  const datos = await lecturasDe(cfg.id, start, end);
  const estado = (p: PuntoSerie) => {
    const t = cfg.variables.t;
    const hr = cfg.variables.hr;
    const et = clasificar(p.t, t.min, t.max, t.margen);
    const eh = clasificar(p.hr, hr.min, hr.max, hr.margen);
    if (et === "bajo" || et === "alto") return `Temperatura: ${TEXTO_VALOR[et].toLowerCase()}`;
    if (eh === "bajo" || eh === "alto") return `Humedad: ${TEXTO_VALOR[eh].toLowerCase()}`;
    return et === "cerca" || eh === "cerca" ? "Cerca del límite" : "En rango";
  };
  return {
    nombre: `Lecturas ${cfg.nombre}`.slice(0, 31),
    titulo: `${cfg.nombre} · lecturas`,
    columnas: [
      "Fecha",
      "Hora",
      "Temperatura (°C)",
      "Humedad (%)",
      "VPD (kPa)",
      ...(cfg.controlada ? ["Estado"] : []),
    ],
    filas: datos.map((p) => [
      diaChile(p.time),
      horaChile(p.time),
      p.t,
      p.hr,
      p.vpd,
      ...(cfg.controlada ? [estado(p)] : []),
    ]),
    anchos: [12, 8, 16, 13, 11, ...(cfg.controlada ? [30] : [])],
  };
}

async function hojaResumen(config: ZonaConfig[], start: string, end: string): Promise<Hoja> {
  const zonas = await getResumen(start, end);
  const filas: Fila[] = [];
  for (const d of listarDias(start, end)) {
    for (const z of zonas) {
      const r = z.dias.find((x) => x.dia === d);
      if (!r || (!r.t && !r.hr)) continue;
      const pct = porcentajeEnRango(r.minutos);
      filas.push([
        d,
        config.find((c) => c.id === z.id)?.nombre ?? z.nombre,
        r.t?.min ?? null,
        redondear(r.t?.prom),
        r.t?.max ?? null,
        r.hr?.min ?? null,
        redondear(r.hr?.prom),
        r.hr?.max ?? null,
        redondear(r.vpd?.prom),
        z.controlada && pct !== null ? redondear(pct, 1) : null,
        z.controlada ? r.minutos.fuera : null,
        r.minutos.sin_datos,
      ]);
    }
  }
  return {
    nombre: "Resumen diario",
    titulo: "Resumen diario por zona",
    columnas: [
      "Fecha",
      "Zona",
      "T mín. (°C)",
      "T prom. (°C)",
      "T máx. (°C)",
      "HR mín. (%)",
      "HR prom. (%)",
      "HR máx. (%)",
      "VPD prom. (kPa)",
      "Tiempo en rango (%)",
      "Fuera de rango (min)",
      "Sin datos (min)",
    ],
    filas,
    anchos: [12, 18, 11, 12, 11, 11, 12, 11, 14, 17, 18, 14],
  };
}

async function hojaEpisodios(start: string, end: string): Promise<Hoja> {
  const episodios = await getEpisodios(start, end);
  return {
    nombre: "Episodios",
    titulo: "Episodios fuera de rango",
    columnas: ["Cámara", "Variable", "Tipo", "Inicio", "Fin", "Duración (min)", "Valor extremo", "Límite", "Unidad"],
    filas: episodios.map((e) => [
      e.zonaNombre,
      e.variable === "t" ? "Temperatura" : "Humedad",
      e.tipo === "bajo" ? "Bajo el mínimo" : "Sobre el máximo",
      `${diaChile(e.inicio)} ${horaChile(e.inicio)}`,
      e.enCurso ? "en curso" : `${diaChile(e.fin)} ${horaChile(e.fin)}`,
      e.duracionMin,
      e.extremo,
      e.limite,
      e.variable === "t" ? "°C" : "%",
    ]),
    anchos: [18, 13, 16, 18, 18, 15, 14, 9, 8],
  };
}

async function descargarLibro(hojas: Hoja[], start: string, end: string, archivo: string) {
  const { default: ExcelJS } = await import("exceljs");
  const libro = new ExcelJS.Workbook();
  libro.creator = "JTE Analytics";

  for (const hoja of hojas) {
    const ws = libro.addWorksheet(hoja.nombre);
    ws.addRow([hoja.titulo]).font = { bold: true, size: 13 };
    ws.addRow([`Viveros El Tambo · del ${start} al ${end} (hora Chile)`]).font = { italic: true };
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  config: ZonaConfig[];
  onClose?: () => void;
}

export default function ExportToExcel({ config, onClose }: ExportToExcelProps) {
  const hoy = hoyChile();
  const [reporte, setReporte] = useState<Reporte>("todo");
  const [startDate, setStartDate] = useState(sumarDias(hoy, -6));
  const [endDate, setEndDate] = useState(hoy);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "danger" | "info"; texto: string } | null>(null);
  const incluyeLecturas = reporte === "todo" || reporte.startsWith("lecturas_");

  const handleExport = async () => {
    if (!startDate || !endDate) {
      setMensaje({ tipo: "danger", texto: "Selecciona ambas fechas." });
      return;
    }
    if (startDate > endDate) {
      setMensaje({ tipo: "danger", texto: "La fecha de inicio debe ser anterior o igual a la de fin." });
      return;
    }
    if (endDate > hoy) {
      setMensaje({ tipo: "danger", texto: "La fecha de fin no puede ser posterior a hoy." });
      return;
    }
    if (listarDias(startDate, endDate).length > 92) {
      setMensaje({ tipo: "danger", texto: "El rango no puede superar 92 días." });
      return;
    }
    if (incluyeLecturas && listarDias(startDate, endDate).length > MAX_DIAS_LECTURAS) {
      setMensaje({ tipo: "danger", texto: `Las lecturas se exportan por un máximo de ${MAX_DIAS_LECTURAS} días.` });
      return;
    }

    setMensaje(null);
    setLoading(true);
    try {
      const zona = (id: ZonaId) => config.find((c) => c.id === id)!;
      let hojas: Hoja[];
      if (reporte === "todo") {
        hojas = await Promise.all([
          hojaResumen(config, startDate, endDate),
          ...ORDEN_ZONAS.map((id) => hojaLecturas(zona(id), startDate, endDate)),
          hojaEpisodios(startDate, endDate),
        ]);
      } else if (reporte === "resumen") {
        hojas = [await hojaResumen(config, startDate, endDate)];
      } else if (reporte === "episodios") {
        hojas = [await hojaEpisodios(startDate, endDate)];
      } else {
        hojas = [await hojaLecturas(zona(reporte.replace("lecturas_", "") as ZonaId), startDate, endDate)];
      }

      if (hojas.every((h) => h.filas.length === 0)) {
        setMensaje({ tipo: "info", texto: "No hay datos para el rango seleccionado." });
        return;
      }
      await descargarLibro(hojas, startDate, endDate, `viveros_${reporte}_${startDate}_${endDate}.xlsx`);
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
          <option value="todo">Todo (resumen diario, lecturas de cada zona y episodios)</option>
          <option value="resumen">Resumen diario por zona</option>
          <option value="episodios">Episodios fuera de rango</option>
          <optgroup label="Lecturas">
            {ORDEN_ZONAS.map((id) => (
              <option key={id} value={`lecturas_${id}`}>
                Lecturas · {config.find((c) => c.id === id)?.nombre}
              </option>
            ))}
          </optgroup>
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
          <Form.Control id="exportInicio" type="date" value={startDate} max={hoy} onChange={(e) => setStartDate(e.target.value)} />
        </Col>
        <Col>
          <Form.Label htmlFor="exportFin">Hasta</Form.Label>
          <Form.Control id="exportFin" type="date" value={endDate} max={hoy} onChange={(e) => setEndDate(e.target.value)} />
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
