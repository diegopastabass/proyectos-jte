import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  DateRangeDto,
  PozoQueryDto,
  VoltajeQueryDto,
} from './models/dto/date-range.dto';
import { Metric, MetricSnapshot } from './models/types';
import {
  EQUIPOS,
  NOMBRE_DE,
  Pozo,
  SENSORES,
  UMBRAL_CORRIENTE_A,
  VARIABLES_CORRIENTE,
  VARIABLES_VOLTAJE,
  variablePozo,
} from '../config/sensores.config';

// mt_time_2 guarda hora de Chile sin zona. Las fechas de los filtros se comparan
// directo contra esa hora local, y al salir se convierte con AT TIME ZONE para
// que el resultado no dependa de la zona en que corra Node ni de la sesión de BD.
const TIME_SQL = `mt_time_2 AT TIME ZONE 'America/Santiago'`;

/** Minutos de lecturas recientes con que se estima la tendencia del vaciado. */
const VENTANA_VACIADO_MIN = 20;
const MIN_MUESTRAS_VACIADO = 5;
/** Bajo esta pendiente (m/min) el estanque se considera estable: 1 mm/min. */
const BANDA_MUERTA_M_POR_MIN = 0.001;
const MAX_TIEMPO_VACIADO_SEG = 7 * 86400;

/** Tiempo máximo que vale una muestra del horómetro si falta la siguiente. */
const MAX_TRAMO_HOROMETRO = `INTERVAL '5 minutes'`;

function mediana(valores: number[]): number {
  if (valores.length === 0) return NaN;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[medio]
    : (ordenados[medio - 1] + ordenados[medio]) / 2;
}

/** Pendiente Theil-Sen: mediana de las pendientes entre todos los pares de puntos. */
function pendienteTheilSen(xs: number[], ys: number[]): number {
  const pendientes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) pendientes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  return mediana(pendientes);
}

function formatearDuracion(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return `${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} m ${String(s).padStart(2, '0')} s`;
}

interface FilaLectura {
  mt_name: string;
  value: string;
  time: Date;
}

interface FilaSerie {
  value: string;
  time: Date;
}

interface FilaDiaria {
  dia: string;
  valor: string | null;
}

export type Tendencia = 'vaciado' | 'llenado' | 'estable' | 'sin_datos';

@Injectable()
export class SsrBalsasService {
  private readonly logger = new Logger(SsrBalsasService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly config: ConfigService,
  ) {}

  private umbral(nombre: string, defecto: number): number {
    const valor = Number(this.config.get<string>(nombre));
    return Number.isFinite(valor) && valor > 0 ? valor : defecto;
  }

  /** Última lectura de cada sensor. Un sondeo por índice en vez de recorrer la tabla. */
  private async ultimasLecturas(): Promise<FilaLectura[]> {
    return this.db.query<FilaLectura[]>(
      `SELECT n.mt_name, u.value, u.time
       FROM unnest($1::TEXT[]) AS n(mt_name)
       CROSS JOIN LATERAL (
         SELECT mt_value AS value, ${TIME_SQL} AS time
         FROM ssr_balsas t
         WHERE t.mt_name = n.mt_name
         ORDER BY t.mt_time_2 DESC
         LIMIT 1
       ) u`,
      [Object.keys(NOMBRE_DE)],
    );
  }

  private ultimoPorEquipo(filas: FilaLectura[]) {
    return EQUIPOS.map((e) => {
      const tiempos = filas
        .filter((f) => f.mt_name.startsWith(`${e.equipo}--`))
        .map((f) => new Date(f.time).getTime());
      return {
        ...e,
        time: tiempos.length
          ? new Date(Math.max(...tiempos)).toISOString()
          : null,
      };
    });
  }

  async getSnapshot() {
    const filas = await this.ultimasLecturas();

    const snapshot: MetricSnapshot = {};
    for (const fila of filas) {
      const nombre = NOMBRE_DE[fila.mt_name];
      snapshot[nombre] = {
        value: Number(fila.value) / SENSORES[nombre].divisor,
        time: new Date(fila.time).toISOString(),
      };
    }

    // El Pozo 1 no tiene señal de bomba: se deduce de su corriente.
    const corriente = snapshot[variablePozo('pozo_1', 'I1')];
    if (corriente) {
      snapshot.pozo_1_bomba = {
        value: corriente.value > UMBRAL_CORRIENTE_A ? 1 : 0,
        time: corriente.time,
      };
    }

    return {
      snapshot,
      equipos: this.ultimoPorEquipo(filas),
      tiempo_vaciado: await this.calcularTiempoVaciado(),
      nivel_alerta: this.umbral('NIVEL_ALERTA', 2),
      nivel_maximo: this.umbral('NIVEL_MAXIMO', 5),
    };
  }

  /** Último dato de cada equipo, con la forma de /snapshot que lee el monitor. */
  async getEquipos() {
    const equipos = this.ultimoPorEquipo(await this.ultimasLecturas());
    const snapshot: Record<string, { time: string | null }> = {};
    for (const e of equipos) {
      snapshot[`${e.nombre} (${e.equipo})`] = { time: e.time };
    }
    return { snapshot };
  }

  /**
   * Tiempo de vaciado a partir de la tendencia de los últimos VENTANA_VACIADO_MIN
   * minutos. La pendiente es Theil-Sen, así un dato atípico no cambia el resultado.
   */
  private async calcularTiempoVaciado(): Promise<{
    tiempo: number;
    formatted: string;
    tendencia: Tendencia;
  }> {
    const { mtName, divisor } = SENSORES.estanque;
    const filas = await this.db.query<FilaSerie[]>(
      `SELECT mt_value AS value, ${TIME_SQL} AS time
       FROM ssr_balsas
       WHERE mt_name = $1
         AND mt_time_2 >= (SELECT MAX(mt_time_2) FROM ssr_balsas WHERE mt_name = $1)
                          - make_interval(mins => $2)
       ORDER BY mt_time_2`,
      [mtName, VENTANA_VACIADO_MIN],
    );
    if (filas.length < MIN_MUESTRAS_VACIADO)
      return { tiempo: 0, formatted: 'Sin datos', tendencia: 'sin_datos' };

    const xs = filas.map((f) => new Date(f.time).getTime() / 1000);
    const ys = filas.map((f) => Number(f.value) / divisor);
    const pendiente = pendienteTheilSen(xs, ys); // m/s

    if (Math.abs(pendiente) * 60 < BANDA_MUERTA_M_POR_MIN)
      return { tiempo: 0, formatted: 'Estable', tendencia: 'estable' };
    if (pendiente > 0)
      return { tiempo: 0, formatted: 'Llenando...', tendencia: 'llenado' };

    const intercepto = mediana(ys.map((y, i) => y - pendiente * xs[i]));
    const nivelActual = intercepto + pendiente * xs[xs.length - 1];
    const tiempo = Math.round(nivelActual / -pendiente);
    return {
      tiempo,
      formatted:
        tiempo > MAX_TIEMPO_VACIADO_SEG
          ? 'Más de 7 días'
          : formatearDuracion(tiempo),
      tendencia: 'vaciado',
    };
  }

  /** Serie de un sensor: por rango de días, o los últimos `limit` registros. */
  private async serie(nombre: string, dto: DateRangeDto): Promise<Metric[]> {
    const { mtName, divisor } = SENSORES[nombre];
    const aMetrica = (fila: FilaSerie): Metric => ({
      time: new Date(fila.time).toISOString(),
      value: Number(fila.value) / divisor,
    });

    if (dto.start && dto.end) {
      const filas = await this.db.query<FilaSerie[]>(
        `SELECT mt_value AS value, ${TIME_SQL} AS time
         FROM ssr_balsas
         WHERE mt_name = $1 AND mt_time_2 >= $2::DATE AND mt_time_2 < $3::DATE + 1
         ORDER BY mt_time_2`,
        [mtName, dto.start, dto.end],
      );
      return filas.map(aMetrica);
    }

    const filas = await this.db.query<FilaSerie[]>(
      `SELECT mt_value AS value, ${TIME_SQL} AS time
       FROM ssr_balsas
       WHERE mt_name = $1
       ORDER BY mt_time_2 DESC
       LIMIT $2`,
      [mtName, dto.limit ?? 100],
    );
    return filas.reverse().map(aMetrica);
  }

  private async seriesPozo<K extends string>(
    pozo: Pozo,
    variables: readonly K[],
    dto: DateRangeDto,
  ): Promise<Record<K, Metric[]>> {
    const series = await Promise.all(
      variables.map((v) => this.serie(variablePozo(pozo, v), dto)),
    );
    return Object.fromEntries(
      variables.map((v, i) => [v, series[i]]),
    ) as Record<K, Metric[]>;
  }

  private exigirRango(dto: DateRangeDto): { start: string; end: string } {
    if (!dto.start || !dto.end)
      throw new BadRequestException('start y end son obligatorios');
    return { start: dto.start, end: dto.end };
  }

  /** Último valor del día menos el primero. Un reinicio del contador deja el día en 0. */
  private async totalDiario(
    nombre: string,
    dto: DateRangeDto,
  ): Promise<Metric[]> {
    const { start, end } = this.exigirRango(dto);
    const { mtName, divisor } = SENSORES[nombre];
    const filas = await this.db.query<FilaDiaria[]>(
      `WITH dias AS (
         SELECT d::DATE AS dia FROM generate_series($2::DATE, $3::DATE, INTERVAL '1 day') d
       )
       SELECT dias.dia::TEXT AS dia,
              GREATEST(ultimo.v - primero.v, 0) AS valor
       FROM dias
       CROSS JOIN LATERAL (
         SELECT mt_value::NUMERIC AS v FROM ssr_balsas
         WHERE mt_name = $1 AND mt_time_2 >= dias.dia AND mt_time_2 < dias.dia + 1
         ORDER BY mt_time_2 ASC LIMIT 1
       ) primero
       CROSS JOIN LATERAL (
         SELECT mt_value::NUMERIC AS v FROM ssr_balsas
         WHERE mt_name = $1 AND mt_time_2 >= dias.dia AND mt_time_2 < dias.dia + 1
         ORDER BY mt_time_2 DESC LIMIT 1
       ) ultimo
       ORDER BY dias.dia`,
      [mtName, start, end],
    );
    return filas.map((f) => ({
      time: f.dia,
      value: Number(f.valor ?? 0) / divisor,
    }));
  }

  getTotalizador(dto: DateRangeDto) {
    return this.totalDiario('totalizador', dto);
  }

  getTotalizadorDescarga(dto: DateRangeDto) {
    return this.totalDiario('totalizador_descarga', dto);
  }

  /**
   * Minutos por día con la bomba en marcha, según la corriente de L1. Cada muestra
   * vale hasta la siguiente (con un tope, para no contar un corte de comunicación
   * como operación) y los tramos que cruzan medianoche se reparten entre los días.
   */
  async getHorometro(dto: PozoQueryDto): Promise<Metric[]> {
    const { start, end } = this.exigirRango(dto);
    const { mtName, divisor } = SENSORES[variablePozo(dto.pozo, 'I1')];
    const filas = await this.db.query<FilaDiaria[]>(
      `WITH muestras AS (
         SELECT mt_time_2 AS ts,
                mt_value::NUMERIC AS corriente,
                LEAD(mt_time_2) OVER (ORDER BY mt_time_2) AS siguiente
         FROM ssr_balsas
         WHERE mt_name = $1
           AND mt_time_2 >= $2::DATE - 1
           AND mt_time_2 < $3::DATE + 2
       ),
       dias AS (
         SELECT d::TIMESTAMP AS inicio FROM generate_series($2::DATE, $3::DATE, INTERVAL '1 day') d
       )
       SELECT dias.inicio::DATE::TEXT AS dia,
              ROUND(EXTRACT(EPOCH FROM COALESCE(SUM(GREATEST(
                LEAST(m.siguiente, m.ts + ${MAX_TRAMO_HOROMETRO}, dias.inicio + INTERVAL '1 day')
                  - GREATEST(m.ts, dias.inicio),
                INTERVAL '0'
              )) FILTER (WHERE m.corriente > $4), INTERVAL '0'))::NUMERIC / 60, 2) AS valor
       FROM dias
       JOIN muestras m
         ON m.siguiente > dias.inicio AND m.ts < dias.inicio + INTERVAL '1 day'
       GROUP BY dias.inicio
       ORDER BY dias.inicio`,
      [mtName, start, end, UMBRAL_CORRIENTE_A * divisor],
    );
    return filas.map((f) => ({ time: f.dia, value: Number(f.valor ?? 0) }));
  }

  getNivel(dto: DateRangeDto) {
    return this.serie('estanque', dto);
  }

  getCaudal(dto: DateRangeDto) {
    return this.serie('caudal', dto);
  }

  getPresion(dto: DateRangeDto) {
    return this.serie('presion', dto);
  }

  getCaudalDescarga(dto: DateRangeDto) {
    return this.serie('caudal_descarga', dto);
  }

  getSolar(dto: DateRangeDto) {
    return this.serie('solar', dto);
  }

  getVoltaje(dto: VoltajeQueryDto) {
    return this.seriesPozo(
      dto.pozo,
      VARIABLES_VOLTAJE[dto.tipo ?? 'linea'],
      dto,
    );
  }

  getCorriente(dto: PozoQueryDto) {
    return this.seriesPozo(dto.pozo, VARIABLES_CORRIENTE, dto);
  }
}
