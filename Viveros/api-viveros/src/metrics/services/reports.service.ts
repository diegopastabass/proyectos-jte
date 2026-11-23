import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type {
  Content,
  TDocumentDefinitions,
  TableCell,
} from 'pdfmake/interfaces';
import type { Umbral } from '../viveros.config';
import type { ResumenDia, Estadistica, MinutosEstado } from '../lib/analisis';
import { diaChile, fechaHoraChile, sumarDias } from '../lib/fechas';
import { generarPdf } from '../lib/pdf';
import { UmbralesService } from './umbrales.service';
import { ViverosService } from './viveros.service';

const COLOR = {
  marca: '#1b5e20',
  texto: '#333333',
  suave: '#777777',
  borde: '#d7e3d4',
  ok: '#198754',
  cerca: '#b07d00',
  fuera: '#dc3545',
  sinDatos: '#8a8f94',
};

const FONDO = {
  ok: '#d1e7dd',
  cerca: '#fff3cd',
  fuera: '#f8d7da',
  sinDatos: '#e9ecef',
};

const MAX_DIAS = 31;

interface Periodo {
  start: string;
  end: string;
}

const num = (v: number | null | undefined, dec = 1) =>
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('es-CL', {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
      });

const duracion = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

const rango = (u: Umbral, unidad: string) => {
  if (u.min !== null && u.max !== null)
    return `${num(u.min)} a ${num(u.max)} ${unidad}`;
  if (u.min !== null) return `mín. ${num(u.min)} ${unidad}`;
  if (u.max !== null) return `máx. ${num(u.max)} ${unidad}`;
  return 'sin rango';
};

const sumar = (a: MinutosEstado, b: MinutosEstado): MinutosEstado => ({
  ok: a.ok + b.ok,
  cerca: a.cerca + b.cerca,
  fuera: a.fuera + b.fuera,
  sin_datos: a.sin_datos + b.sin_datos,
});

/** % del tiempo con datos que estuvo en rango (incluye "cerca del límite"). */
export const porcentajeEnRango = (m: MinutosEstado): number | null => {
  const conDatos = m.ok + m.cerca + m.fuera;
  return conDatos > 0 ? ((m.ok + m.cerca) / conDatos) * 100 : null;
};

const nivel = (m: MinutosEstado): keyof typeof FONDO => {
  const total = m.ok + m.cerca + m.fuera + m.sin_datos;
  const pct = porcentajeEnRango(m);
  if (pct === null || m.sin_datos > total * 0.5) return 'sinDatos';
  if (pct >= 95) return 'ok';
  if (pct >= 80) return 'cerca';
  return 'fuera';
};

/** Combina las estadísticas diarias (el promedio se pondera por día, es aproximado). */
const combinar = (lista: (Estadistica | null)[]): Estadistica | null => {
  const v = lista.filter((x): x is Estadistica => x !== null);
  if (!v.length) return null;
  return {
    min: Math.min(...v.map((x) => x.min)),
    max: Math.max(...v.map((x) => x.max)),
    prom: v.reduce((s, x) => s + x.prom, 0) / v.length,
  };
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly viveros: ViverosService,
    private readonly umbrales: UmbralesService,
  ) {}

  /** Semana anterior completa (lunes a domingo, hora Chile). */
  semanaAnterior(): Periodo {
    const hoy = diaChile();
    const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 = domingo
    const lunesActual = sumarDias(hoy, -((diaSemana + 6) % 7));
    return { start: sumarDias(lunesActual, -7), end: sumarDias(lunesActual, -1) };
  }

  async generar(periodo?: Partial<Periodo>): Promise<{ buffer: Buffer; periodo: Periodo }> {
    const p =
      periodo?.start && periodo?.end
        ? { start: periodo.start, end: periodo.end }
        : this.semanaAnterior();
    if (p.start > p.end) throw new BadRequestException('start debe ser anterior o igual a end');
    if (sumarDias(p.start, MAX_DIAS) <= p.end)
      throw new BadRequestException(`El informe admite como máximo ${MAX_DIAS} días`);

    try {
      const [resumen, episodios, umbrales] = await Promise.all([
        this.viveros.resumenDiario(p.start, p.end),
        this.viveros.episodios(p.start, p.end),
        this.umbrales.porZona(),
      ]);
      const doc = this.documento(p, resumen.zonas, episodios, umbrales);
      const buffer = await generarPdf(doc);
      return { buffer, periodo: p };
    } catch (error) {
      this.logger.error('Error generando el informe', error);
      throw new InternalServerErrorException('Error generando el informe');
    }
  }

  private documento(
    p: Periodo,
    zonas: { id: string; nombre: string; controlada: boolean; dias: ResumenDia[] }[],
    episodios: Awaited<ReturnType<ViverosService['episodios']>>,
    umbrales: Awaited<ReturnType<UmbralesService['porZona']>>,
  ): TDocumentDefinitions {
    const controladas = zonas.filter((z) => z.controlada);
    const exterior = zonas.find((z) => !z.controlada);
    const dias = controladas[0]?.dias.map((d) => d.dia) ?? [];
    const cero: MinutosEstado = { ok: 0, cerca: 0, fuera: 0, sin_datos: 0 };

    const encabezado = (texto: string): TableCell => ({
      text: texto,
      bold: true,
      fontSize: 8,
      color: COLOR.marca,
      fillColor: '#f1f8e9',
    });
    const celda = (texto: string, extra: Record<string, unknown> = {}): TableCell => ({
      text: texto,
      fontSize: 8,
      color: COLOR.texto,
      ...extra,
    });
    const layout = {
      hLineColor: () => COLOR.borde,
      vLineColor: () => COLOR.borde,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    };

    // ── Resumen por cámara ────────────────────────────────────────────
    const filasResumen: TableCell[][] = controladas.map((z) => {
      const u = umbrales[z.id as keyof typeof umbrales];
      const total = z.dias.reduce((acc, d) => sumar(acc, d.minutos), cero);
      const pct = porcentajeEnRango(total);
      const n = nivel(total);
      const t = combinar(z.dias.map((d) => d.t));
      const hr = combinar(z.dias.map((d) => d.hr));
      const vpd = combinar(z.dias.map((d) => d.vpd));
      return [
        celda(z.nombre, { bold: true }),
        celda(pct === null ? 'Sin datos' : `${num(pct, 1)} %`, {
          bold: true,
          color: COLOR[n],
          fillColor: FONDO[n],
          alignment: 'center',
        }),
        celda(duracion(total.fuera), { alignment: 'center' }),
        celda(duracion(total.sin_datos), { alignment: 'center' }),
        celda(t ? `${num(t.min)} / ${num(t.prom)} / ${num(t.max)}` : '—', { alignment: 'center' }),
        celda(rango(u.t, '°C'), { alignment: 'center', color: COLOR.suave }),
        celda(hr ? `${num(hr.min)} / ${num(hr.prom)} / ${num(hr.max)}` : '—', { alignment: 'center' }),
        celda(rango(u.hr, '%'), { alignment: 'center', color: COLOR.suave }),
        celda(vpd ? num(vpd.prom, 2) : '—', { alignment: 'center' }),
      ];
    });

    // ── Cumplimiento diario (mapa de calor) ───────────────────────────
    const filasDiarias: TableCell[][] = controladas.map((z) => [
      celda(z.nombre, { bold: true }),
      ...z.dias.map((d) => {
        const pct = porcentajeEnRango(d.minutos);
        const n = nivel(d.minutos);
        return celda(pct === null ? 's/d' : `${Math.round(pct)} %`, {
          alignment: 'center',
          bold: true,
          color: COLOR[n],
          fillColor: FONDO[n],
        });
      }),
    ]);

    // ── Episodios ─────────────────────────────────────────────────────
    const masLargos = [...episodios]
      .sort((a, b) => b.duracionMin - a.duracionMin)
      .slice(0, 30);
    const nombreVariable = { t: 'Temperatura', hr: 'Humedad' };
    const unidad = { t: '°C', hr: '%' };
    const filasEpisodios: TableCell[][] = masLargos.length
      ? masLargos.map((e) => [
          celda(e.zonaNombre),
          celda(nombreVariable[e.variable]),
          celda(e.tipo === 'bajo' ? 'Bajo el mínimo' : 'Sobre el máximo', {
            color: COLOR.fuera,
          }),
          celda(fechaHoraChile(new Date(e.inicio))),
          celda(e.enCurso ? 'en curso' : fechaHoraChile(new Date(e.fin))),
          celda(duracion(e.duracionMin), { alignment: 'right' }),
          celda(`${num(e.extremo)} ${unidad[e.variable]}`, { alignment: 'right', bold: true }),
          celda(e.limite === null ? '—' : `${num(e.limite)} ${unidad[e.variable]}`, {
            alignment: 'right',
            color: COLOR.suave,
          }),
        ])
      : [
          [
            celda('Sin episodios fuera de rango en el período.', {
              colSpan: 8,
              alignment: 'center',
              color: COLOR.ok,
            }),
            {}, {}, {}, {}, {}, {}, {},
          ],
        ];

    // ── Observaciones automáticas ─────────────────────────────────────
    const observaciones: string[] = [];
    for (const z of zonas) {
      for (const v of ['t', 'hr'] as const) {
        const est = z.dias.map((d) => d[v]).filter((x): x is Estadistica => x !== null);
        if (est.length >= 2 && est.every((e) => e.min === e.max && e.min === est[0].min)) {
          observaciones.push(
            `${z.nombre}: la ${nombreVariable[v].toLowerCase()} marcó ${num(est[0].min)} ${unidad[v]} todo el período, sin variación. Revisar el sensor.`,
          );
        }
      }
      const total = z.dias.reduce((acc, d) => sumar(acc, d.minutos), cero);
      const minutosPeriodo = total.ok + total.cerca + total.fuera + total.sin_datos;
      if (total.sin_datos > Math.max(60, minutosPeriodo * 0.05)) {
        observaciones.push(`${z.nombre}: ${duracion(total.sin_datos)} sin datos en el período.`);
      }
    }

    const t = exterior ? combinar(exterior.dias.map((d) => d.t)) : null;
    const hr = exterior ? combinar(exterior.dias.map((d) => d.hr)) : null;

    const contenido: Content[] = [
      {
        columns: [
          {
            stack: [
              { text: 'Informe de condiciones', fontSize: 18, bold: true, color: COLOR.marca },
              { text: 'Viveros El Tambo · Cámaras de frío y calor', fontSize: 10, color: '#555', margin: [0, 3, 0, 2] },
              { text: `Período: ${p.start} al ${p.end} (hora Chile)`, fontSize: 9, italics: true, color: COLOR.suave },
            ],
          },
          { text: 'JTE Analytics', alignment: 'right', fontSize: 13, bold: true, color: '#2e7d32', margin: [0, 8, 0, 0] },
        ],
        margin: [0, 0, 0, 10],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 781, y2: 0, lineWidth: 1.5, lineColor: '#2e7d32' }], margin: [0, 0, 0, 12] },

      { text: 'Resumen por cámara', fontSize: 11, bold: true, color: COLOR.marca, margin: [0, 0, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: ['14%', '10%', '10%', '9%', '13%', '11%', '13%', '10%', '10%'],
          body: [
            [
              encabezado('Cámara'),
              encabezado('Tiempo en rango'),
              encabezado('Fuera de rango'),
              encabezado('Sin datos'),
              encabezado('T mín / prom / máx (°C)'),
              encabezado('Rango T'),
              encabezado('HR mín / prom / máx (%)'),
              encabezado('Rango HR'),
              encabezado('VPD prom. (kPa)'),
            ],
            ...filasResumen,
          ],
        },
        layout,
      },
      {
        text: '"Tiempo en rango" es el porcentaje del tiempo con datos en que temperatura y humedad estuvieron dentro del rango permitido. Verde: 95 % o más; ámbar: 80 a 95 %; rojo: menos de 80 %; gris: más de la mitad del tiempo sin datos.',
        fontSize: 7,
        color: COLOR.suave,
        margin: [0, 4, 0, 12],
      },

      { text: 'Tiempo en rango por día', fontSize: 11, bold: true, color: COLOR.marca, margin: [0, 0, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: ['14%', ...dias.map(() => '*')],
          body: [
            [encabezado('Cámara'), ...dias.map((d) => encabezado(`${d.slice(8, 10)}-${d.slice(5, 7)}`))],
            ...filasDiarias,
          ],
        },
        layout,
        margin: [0, 0, 0, 12],
      },
    ];

    if (exterior) {
      contenido.push({
        text: [
          { text: 'Exterior (Open-Meteo, estimado): ', bold: true },
          `temperatura ${t ? `${num(t.min)} a ${num(t.max)} °C (prom. ${num(t.prom)})` : 'sin datos'}; humedad ${hr ? `${num(hr.min)} a ${num(hr.max)} %` : 'sin datos'}.`,
        ],
        fontSize: 8,
        color: COLOR.texto,
        margin: [0, 0, 0, 12],
      });
    }

    contenido.push(
      { text: `Episodios fuera de rango (${episodios.length} en total; se muestran los ${masLargos.length} más largos)`, fontSize: 11, bold: true, color: COLOR.marca, margin: [0, 0, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: ['14%', '11%', '13%', '14%', '14%', '11%', '11%', '12%'],
          body: [
            [
              encabezado('Cámara'),
              encabezado('Variable'),
              encabezado('Tipo'),
              encabezado('Inicio'),
              encabezado('Fin'),
              encabezado('Duración'),
              encabezado('Valor extremo'),
              encabezado('Límite'),
            ],
            ...filasEpisodios,
          ],
        },
        layout,
        margin: [0, 0, 0, 12],
      },
    );

    if (observaciones.length) {
      contenido.push(
        { text: 'Observaciones', fontSize: 11, bold: true, color: COLOR.marca, margin: [0, 0, 0, 4] },
        { ul: observaciones, fontSize: 8, color: COLOR.texto },
      );
    }

    return {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [30, 30, 30, 36],
      content: contenido,
      footer: (pagina: number, total: number) => ({
        text: `Página ${pagina} de ${total} · Generado por JTE Analytics el ${fechaHoraChile(Date.now())}`,
        alignment: 'center',
        fontSize: 7,
        color: '#aaaaaa',
        margin: [0, 12, 0, 0],
      }),
      defaultStyle: { font: 'Roboto' },
    };
  }
}

