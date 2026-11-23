import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from '../models/metric.entity';
import {
  FRESCURA,
  HORAS_PEGADO,
  MARGENES,
  VALIDOS,
  ZONAS,
  ZONAS_IDS,
  ZonaId,
  valorSql,
} from '../viveros.config';
import {
  calcularVpd,
  clasificar,
  detectarEpisodios,
  estadoLectura,
  fueraDesde,
  Lectura,
  ResumenDia,
  resumirDias,
  UmbralesZona,
} from '../lib/analisis';
import {
  diaChile,
  inicioDiaChile,
  listarDias,
  localDeInstante,
  sumarDias,
  textoLocal,
} from '../lib/fechas';
import { UmbralesService } from './umbrales.service';
import { ultimasPorSensor } from '../lib/consultas';

const MAX_DIAS_SERIE = 31;
const MAX_DIAS_RESUMEN = 92;

const valido = (v: number | null, r: { min: number; max: number }) =>
  v !== null && v >= r.min && v <= r.max ? v : null;

/** Rango [desde, hasta) en hora Chile a partir de días con `end` inclusivo. */
export function rangoDias(start: string, end: string, maxDias: number) {
  if (start > end) throw new BadRequestException('start debe ser anterior o igual a end');
  const dias = listarDias(start, end);
  if (dias.length > maxDias)
    throw new BadRequestException(`El rango no puede superar ${maxDias} días`);
  return { desde: textoLocal(start), hasta: textoLocal(sumarDias(end, 1)), dias };
}

@Injectable()
export class ViverosService {
  /** Resúmenes de días cerrados (hasta anteayer): no cambian salvo que cambien los umbrales. */
  private readonly cacheDias = new Map<string, ResumenDia>();
  private versionCache = 0;

  constructor(
    @InjectRepository(Metric)
    private readonly repo: Repository<Metric>,
    private readonly umbrales: UmbralesService,
  ) {}

  /** Lecturas de una zona con T y HR emparejadas por hora (se insertan juntas). */
  async lecturas(zona: ZonaId, desde: string, hasta: string): Promise<Lectura[]> {
    const { sensorT, sensorHr } = ZONAS[zona];
    const filas: { instante: Date; t: number | null; hr: number | null }[] =
      await this.repo.query(
        `SELECT time AT TIME ZONE 'America/Santiago' AS instante,
                MAX(CASE WHEN sensor_id = $1 THEN ${valorSql()} END)::float8 AS t,
                MAX(CASE WHEN sensor_id = $2 THEN value END)::float8 AS hr
           FROM viveros_tambo
          WHERE sensor_id IN ($1, $2) AND time >= $3 AND time < $4
          GROUP BY time
          ORDER BY time`,
        [sensorT, sensorHr, desde, hasta],
      );
    return filas.map((f) => {
      const t = valido(f.t, VALIDOS.t);
      const hr = valido(f.hr, VALIDOS.hr);
      return { ms: new Date(f.instante).getTime(), t, hr, vpd: calcularVpd(t, hr) };
    });
  }

  private rangoSerie(q: { start?: string; end?: string; horas?: number }) {
    if (q.start && q.end) return rangoDias(q.start, q.end, MAX_DIAS_SERIE);
    if (q.start || q.end) throw new BadRequestException('Indica start y end, o horas');
    const horas = q.horas ?? 24;
    return {
      desde: localDeInstante(Date.now() - horas * 3600_000),
      hasta: localDeInstante(Date.now() + 60_000),
    };
  }

  async serie(q: { zona: ZonaId; start?: string; end?: string; horas?: number }) {
    const { desde, hasta } = this.rangoSerie(q);
    const lecturas = await this.lecturas(q.zona, desde, hasta);
    return lecturas.map((l) => ({ time: new Date(l.ms).toISOString(), t: l.t, hr: l.hr, vpd: l.vpd }));
  }

  /** Último valor de cada sensor, aunque sea antiguo (una consulta por sensor con índice). */
  private async ultimos(sensores: string[]) {
    const filas = await ultimasPorSensor(this.repo, sensores);
    return new Map(filas.map((f) => [f.sensor_id, { value: f.value, ms: new Date(f.time).getTime() }]));
  }

  /** Estado actual de cada zona, con lo ocurrido hoy (respuesta de `GET /estado`). */
  async estado() {
    const ahora = Date.now();
    const hoy = diaChile(ahora);
    const umbrales = await this.umbrales.porZona();
    const sensores = ZONAS_IDS.flatMap((z) => {
      const d = ZONAS[z];
      return [d.sensorT, d.sensorHr, ...(d.sensorEquipo ? [d.sensorEquipo] : [])];
    });
    const ultimos = await this.ultimos(sensores);
    const desdeAyer = textoLocal(sumarDias(hoy, -1));
    const hasta = localDeInstante(ahora + 60_000);

    const zonas = await Promise.all(
      ZONAS_IDS.map(async (id) => {
        const def = ZONAS[id];
        const u = umbrales[id];
        const lecturas = await this.lecturas(id, desdeAyer, hasta);
        const ultT = ultimos.get(def.sensorT);
        const ultHr = ultimos.get(def.sensorHr);
        const ultimoMs = Math.max(ultT?.ms ?? 0, ultHr?.ms ?? 0) || null;
        const minutosSinDato = ultimoMs ? (ahora - ultimoMs) / 60000 : Infinity;
        const frescura =
          minutosSinDato <= FRESCURA.retrasoMin
            ? 'al_dia'
            : minutosSinDato <= FRESCURA.sinDatosMin
              ? 'retrasado'
              : 'sin_datos';

        const t = valido(ultT?.value ?? null, VALIDOS.t);
        const hr = valido(ultHr?.value ?? null, VALIDOS.hr);
        const vpd = calcularVpd(t, hr);
        const actual: Lectura = { ms: ultimoMs ?? 0, t, hr, vpd };
        const estado =
          frescura === 'sin_datos'
            ? 'sin_datos'
            : def.controlada
              ? estadoLectura(actual, u)
              : 'informativo';

        const [resumenHoy] = resumirDias(lecturas, [hoy], u, def.topeMin, ahora);
        const desdeFuera = estado === 'fuera' ? fueraDesde(lecturas, u, def.topeMin) : null;
        const equipo = def.sensorEquipo ? ultimos.get(def.sensorEquipo) : undefined;

        return {
          id,
          nombre: def.nombre,
          controlada: def.controlada,
          origen: def.origen,
          ultimo: ultimoMs ? new Date(ultimoMs).toISOString() : null,
          frescura,
          estado,
          fueraDesde: desdeFuera ? new Date(desdeFuera).toISOString() : null,
          t: { valor: t, estado: clasificar(t, u.t, MARGENES.t), pegadoDesde: this.pegadoDesde(lecturas, 't', ahora) },
          hr: { valor: hr, estado: clasificar(hr, u.hr, MARGENES.hr), pegadoDesde: this.pegadoDesde(lecturas, 'hr', ahora) },
          vpd: { valor: vpd, estado: clasificar(vpd, u.vpd, MARGENES.vpd) },
          hoy: resumenHoy,
          equipo: equipo ? { valor: equipo.value, time: new Date(equipo.ms).toISOString() } : null,
        };
      }),
    );
    return { generado: new Date(ahora).toISOString(), zonas };
  }

  /**
   * Si la variable repite el mismo valor durante las últimas `HORAS_PEGADO` horas,
   * devuelve desde cuándo (dentro de lo cargado: desde ayer a las 00:00).
   */
  private pegadoDesde(lecturas: Lectura[], v: 't' | 'hr', ahora: number): string | null {
    const conValor = lecturas.filter((l) => l[v] !== null);
    if (!conValor.length) return null;
    const ultimo = conValor[conValor.length - 1];
    if (ahora - ultimo.ms > FRESCURA.sinDatosMin * 60000) return null;
    let i = conValor.length - 1;
    while (i > 0 && conValor[i - 1][v] === ultimo[v]) i--;
    const desde = conValor[i].ms;
    const enVentana = conValor.length - i;
    return ultimo.ms - desde >= HORAS_PEGADO * 3600_000 && enVentana >= 30
      ? new Date(desde).toISOString()
      : null;
  }

  /** Resumen por zona y día (respuesta de `GET /resumen-diario`). */
  async resumenDiario(start: string, end: string) {
    const { dias } = rangoDias(start, end, MAX_DIAS_RESUMEN);
    const ahora = Date.now();
    const hoy = diaChile(ahora);
    const cerrado = sumarDias(hoy, -2);
    const umbrales = await this.umbrales.porZona();
    const version = this.umbrales.version;
    if (version !== this.versionCache) {
      this.cacheDias.clear();
      this.versionCache = version;
    }

    const zonas = await Promise.all(
      ZONAS_IDS.map(async (id) => {
        const def = ZONAS[id];
        const clave = (d: string) => `${version}|${id}|${d}`;
        const resultado = new Map<string, ResumenDia>();
        for (const d of dias) {
          const c = this.cacheDias.get(clave(d));
          if (c) resultado.set(d, c);
        }
        const faltan = dias.filter((d) => !resultado.has(d));
        if (faltan.length) {
          // Desde un tope antes de la medianoche: la última lectura del día anterior cubre los primeros minutos.
          const lecturas = await this.lecturas(
            id,
            localDeInstante(inicioDiaChile(faltan[0]) - def.topeMin * 60000),
            textoLocal(sumarDias(faltan[faltan.length - 1], 1)),
          );
          for (const r of resumirDias(lecturas, faltan, umbrales[id], def.topeMin, ahora)) {
            resultado.set(r.dia, r);
            if (r.dia <= cerrado) this.cacheDias.set(clave(r.dia), r);
          }
        }
        const resumen = dias.map((d) => resultado.get(d)!);
        return { id, nombre: def.nombre, controlada: def.controlada, dias: resumen };
      }),
    );
    return { start, end, zonas };
  }

  /** Promedios por hora de una zona (respuesta de `GET /horario`). */
  async horario(zona: ZonaId, start: string, end: string) {
    const { desde, hasta } = rangoDias(start, end, MAX_DIAS_SERIE);
    const { sensorT, sensorHr } = ZONAS[zona];
    const filas: { hora: Date; t: number | null; hr: number | null; vpd: number | null }[] =
      await this.repo.query(
        `WITH l AS (
           SELECT time,
                  MAX(CASE WHEN sensor_id = $1 THEN ${valorSql()} END)::float8 AS t,
                  MAX(CASE WHEN sensor_id = $2 THEN value END)::float8 AS hr
             FROM viveros_tambo
            WHERE sensor_id IN ($1, $2) AND time >= $3 AND time < $4
            GROUP BY time
         ), v AS (
           SELECT time,
                  CASE WHEN t BETWEEN $5 AND $6 THEN t END AS t,
                  CASE WHEN hr BETWEEN $7 AND $8 THEN hr END AS hr
             FROM l
         )
         SELECT date_trunc('hour', time) AT TIME ZONE 'America/Santiago' AS hora,
                ROUND(AVG(t)::numeric, 2)::float8 AS t,
                ROUND(AVG(hr)::numeric, 2)::float8 AS hr,
                ROUND(AVG(0.6108 * exp(17.27 * t / (t + 237.3)) * (1 - hr / 100))::numeric, 2)::float8 AS vpd
           FROM v
          GROUP BY 1
          ORDER BY 1`,
        [sensorT, sensorHr, desde, hasta, VALIDOS.t.min, VALIDOS.t.max, VALIDOS.hr.min, VALIDOS.hr.max],
      );
    return filas.map((f) => ({ time: new Date(f.hora).toISOString(), t: f.t, hr: f.hr, vpd: f.vpd }));
  }

  /** Episodios fuera de rango de las zonas controladas (respuesta de `GET /episodios`). */
  async episodios(start: string, end: string, zona?: ZonaId) {
    const { desde, hasta } = rangoDias(start, end, MAX_DIAS_RESUMEN);
    const umbrales = await this.umbrales.porZona();
    const zonas = ZONAS_IDS.filter((z) => ZONAS[z].controlada && (!zona || z === zona));
    const todos = await Promise.all(
      zonas.map(async (id) => {
        const u = umbrales[id];
        const lecturas = await this.lecturas(id, desde, hasta);
        return detectarEpisodios(lecturas, u, ZONAS[id].topeMin).map((e) => ({
          zona: id,
          zonaNombre: ZONAS[id].nombre,
          variable: e.variable,
          tipo: e.tipo,
          inicio: new Date(e.inicio).toISOString(),
          fin: new Date(e.fin).toISOString(),
          duracionMin: Math.round((e.fin - e.inicio) / 60000),
          extremo: e.extremo,
          limite: e.tipo === 'bajo' ? u[e.variable].min : u[e.variable].max,
          enCurso: e.enCurso,
        }));
      }),
    );
    return todos
      .flat()
      .sort((a, b) => b.inicio.localeCompare(a.inicio))
      .slice(0, 500);
  }
}
