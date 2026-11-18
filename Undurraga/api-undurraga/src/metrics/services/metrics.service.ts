import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from '../models/metric.entity';
import { CreateMetricDto } from '../models/dto/create-metric.dto';

/** 1 y 2: caudal (m³/h). 4 y 3: totalizadores 1 y 2 (m³). 5: contador de la piscina (m³). */
export const SENSORES = {
  caudal: [1, 2],
  totalizador: [3, 4, 5],
} as const;

const SENSORES_SNAPSHOT = [...SENSORES.caudal, ...SENSORES.totalizador];

type TipoSensor = keyof typeof SENSORES;

export interface Punto {
  value: number;
  time: string;
}

interface FilaDia {
  dia: string;
  valor: number | string | null;
}

interface FilaHora {
  hora: Date;
  valor: number | string | null;
}

interface LecturaPendiente extends CreateMetricDto {
  time: Date;
}

/**
 * `time` es timestamptz: los días y horas se calculan explícitamente en hora de Chile
 * (`AT TIME ZONE`), sin depender de la zona de la sesión ni del proceso Node.
 */
const TZ = `'America/Santiago'`;
const inicioDia = (param: string) =>
  `(${param}::date)::timestamp AT TIME ZONE ${TZ}`;
const finDia = (param: string) =>
  `(${param}::date + 1)::timestamp AT TIME ZONE ${TZ}`;
const diaLocal = `(time AT TIME ZONE ${TZ})::date`;
const horaLocal = `date_trunc('hour', time AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`;

/** Fecha de hoy (AAAA-MM-DD) en hora de Chile, sin depender de la zona del proceso. */
const hoyChile = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(
    new Date(),
  );

/** Suma días a una fecha AAAA-MM-DD (aritmética en UTC, así que no la afecta el horario de verano). */
const sumarDias = (dia: string, n: number): string => {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const listarDias = (desde: string, hasta: string): string[] => {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
};

/** Una lectura igual del mismo sensor dentro de este plazo se considera un reenvío. */
const MS_DUPLICADO = 5000;

/**
 * Las diferencias entre lecturas se calculan ordenando por `time, id`. A diferencia de Montes,
 * `time` es timestamptz (sin hora repetida en abril), y las cargas manuales del historial se
 * hicieron después (tienen `id` mayor que lecturas posteriores), así que el orden por `id`
 * las dejaría fuera de lugar. El `id` solo desempata lecturas con la misma hora.
 */
@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private metricsBuffer: LecturaPendiente[] = [];
  private flushInterval: NodeJS.Timeout;

  /** Caudal máximo creíble (m³/h). Incrementos del totalizador por sobre esto se descartan. */
  private readonly maxM3h: number;

  /** Máximo de horas que puede representar una lectura de caudal al integrar el volumen. */
  private readonly maxHorasLectura: number;

  private tablaDiariaDisponible = true;

  constructor(
    @InjectRepository(Metric)
    private readonly metricRepository: Repository<Metric>,
    config: ConfigService,
  ) {
    this.maxM3h = Number(config.get('TOTALIZADOR_MAX_M3H') ?? 500);
    this.maxHorasLectura =
      Number(config.get('INTERVALO_MAX_MINUTOS') ?? 15) / 60;
  }

  onModuleInit() {
    this.flushInterval = setInterval(() => {
      void this.flushMetrics();
    }, 30000);
  }

  async onModuleDestroy() {
    clearInterval(this.flushInterval);
    await this.flushMetrics();
  }

  /**
   * Ingesta desde terreno: el contrato (ruta, cuerpo, respuesta y errores) se mantiene igual.
   * Internamente, la lectura se guarda con la hora en que llegó (antes era la hora del insert
   * del lote, igual para todas las filas) y un reenvío idéntico en pocos segundos se descarta.
   */
  createMetric(dto: CreateMetricDto): { success: boolean; message: string } {
    if (!dto.sensor_id || dto.value === undefined || dto.value === null) {
      throw new Error(
        'Debe proporcionar sensor_id y value para insertar un nuevo registro.',
      );
    }

    const ahora = new Date();
    const repetida = this.metricsBuffer.some(
      (m) =>
        m.sensor_id === dto.sensor_id &&
        m.value === dto.value &&
        ahora.getTime() - m.time.getTime() < MS_DUPLICADO,
    );
    if (!repetida) {
      this.metricsBuffer.push({ ...dto, time: ahora });
      if (this.metricsBuffer.length >= 100) {
        void this.flushMetrics();
      }
    }
    return { success: true, message: 'Metric buffered' };
  }

  private async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    const dataToSave = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      await this.metricRepository
        .createQueryBuilder()
        .insert()
        .into(Metric)
        .values(dataToSave)
        .execute();

      this.logger.log(
        `Bulk inserted ${dataToSave.length} metrics for Undurraga`,
      );
    } catch (error) {
      this.logger.error('Error in bulk insert', error);
    }
  }

  private validarSensor(sensor: number, tipo: TipoSensor) {
    if (!(SENSORES[tipo] as readonly number[]).includes(sensor)) {
      throw new NotFoundException(`Sensor de ${tipo} desconocido: ${sensor}`);
    }
  }

  /** Ambas fechas o ninguna, y en orden. */
  private validarRango(start?: string, end?: string): boolean {
    if (!start && !end) return false;
    if (!start || !end) {
      throw new BadRequestException('Se requieren start y end juntos');
    }
    if (start > end) {
      throw new BadRequestException('start debe ser anterior o igual a end');
    }
    return true;
  }

  /** Última lectura de cada sensor. Usa el índice (sensor_id, time). */
  async getSnapshot(): Promise<Record<string, Punto>> {
    const rows: { sensor_id: number; value: string; time: Date }[] =
      await this.metricRepository.query(
        `SELECT DISTINCT ON (sensor_id) sensor_id, value, time
         FROM undurraga_metrics
         WHERE sensor_id = ANY($1::int[])
         ORDER BY sensor_id, time DESC, id DESC`,
        [SENSORES_SNAPSHOT],
      );

    const resultado: Record<string, Punto> = {};
    rows.forEach((r) => {
      resultado[r.sensor_id] = {
        value: Number(r.value),
        time: r.time.toISOString(),
      };
    });
    return resultado;
  }

  /** Lecturas crudas de caudal del rango de días, o de las últimas 24 h si no hay rango. */
  async getCaudal(sensor: number, start?: string, end?: string) {
    this.validarSensor(sensor, 'caudal');
    const conRango = this.validarRango(start, end);

    const filtro = conRango
      ? `time >= ${inicioDia('$2')} AND time < ${finDia('$3')}`
      : "time >= now() - INTERVAL '24 hours'";
    const rows: { time: Date; value: string }[] =
      await this.metricRepository.query(
        `SELECT time, value
         FROM undurraga_metrics
         WHERE sensor_id = $1 AND ${filtro}
         ORDER BY time, id`,
        conRango ? [sensor, start, end] : [sensor],
      );

    return rows.map(
      (r): Punto => ({ value: Number(r.value), time: r.time.toISOString() }),
    );
  }

  /** Consumo diario (m³). Sin rango: últimos 15 días. */
  async getDailyTotalizer(sensor: number, start?: string, end?: string) {
    this.validarSensor(sensor, 'totalizador');
    const hoy = hoyChile();
    const conRango = this.validarRango(start, end);
    return this.diario(
      sensor,
      listarDias(
        conRango ? start! : sumarDias(hoy, -14),
        conRango ? end! : hoy,
      ),
    );
  }

  /** Consumo mensual (m³) de los últimos `meses` meses, incluido el actual. */
  async getMonthlyTotalizer(sensor: number, meses = 12) {
    this.validarSensor(sensor, 'totalizador');
    const hoy = hoyChile();
    const inicio = new Date(`${hoy.slice(0, 7)}-01T00:00:00Z`);
    inicio.setUTCMonth(inicio.getUTCMonth() - (meses - 1));
    const dias = await this.diario(
      sensor,
      listarDias(inicio.toISOString().slice(0, 10), hoy),
    );

    const porMes = new Map<string, number>();
    for (const d of dias) {
      const mes = d.time.slice(0, 7);
      porMes.set(mes, (porMes.get(mes) ?? 0) + d.value);
    }
    return [...porMes].map(([time, value]): Punto => ({ time, value }));
  }

  /** Consumo por hora (m³) según el totalizador. Sin rango: últimas 24 h. */
  async getHourlyTotalizer(sensor: number, start?: string, end?: string) {
    this.validarSensor(sensor, 'totalizador');
    const conRango = this.validarRango(start, end);
    const desde = conRango ? inicioDia('$2') : "now() - INTERVAL '24 hours'";
    const hasta = conRango ? finDia('$3') : 'now()';
    const pmax = conRango ? '$4' : '$2';

    const rows: FilaHora[] = await this.metricRepository.query(
      `WITH s AS (
         SELECT time, value::float8 AS v,
                LAG(value::float8) OVER (ORDER BY time, id) AS prev,
                LAG(time) OVER (ORDER BY time, id) AS prev_time
         FROM undurraga_metrics
         WHERE sensor_id = $1 AND time >= ${desde} - INTERVAL '1 day' AND time < ${hasta}
       )
       SELECT ${horaLocal} AS hora,
              COALESCE(SUM(v - prev) FILTER (
                WHERE v > prev
                  AND v - prev <= ${pmax} * GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0.25)
              ), 0) AS valor
       FROM s
       WHERE time >= ${desde} AND prev IS NOT NULL
       GROUP BY 1
       ORDER BY 1`,
      conRango ? [sensor, start, end, this.maxM3h] : [sensor, this.maxM3h],
    );

    return rows.map(
      (r): Punto => ({ value: Number(r.valor), time: r.hora.toISOString() }),
    );
  }

  /**
   * Volumen por hora (m³) integrando el caudal (m³/h): cada lectura vale por el tiempo
   * transcurrido desde la anterior, con tope `INTERVALO_MAX_MINUTOS` para que un corte
   * no se cuente como horas de caudal.
   */
  async getHourlyVolumeFromFlow(sensor: number, start?: string, end?: string) {
    this.validarSensor(sensor, 'caudal');
    const conRango = this.validarRango(start, end);
    const desde = conRango ? inicioDia('$2') : "now() - INTERVAL '24 hours'";
    const hasta = conRango ? finDia('$3') : 'now()';
    const pmax = conRango ? '$4' : '$2';

    const rows: FilaHora[] = await this.metricRepository.query(
      `WITH s AS (
         SELECT time, value::float8 AS v, LAG(time) OVER (ORDER BY time, id) AS prev_time
         FROM undurraga_metrics
         WHERE sensor_id = $1 AND time >= ${desde} - INTERVAL '1 hour' AND time < ${hasta}
       )
       SELECT ${horaLocal} AS hora,
              SUM(v * LEAST(GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0), ${pmax})) AS valor
       FROM s
       WHERE time >= ${desde} AND prev_time IS NOT NULL
       GROUP BY 1
       ORDER BY 1`,
      conRango
        ? [sensor, start, end, this.maxHorasLectura]
        : [sensor, this.maxHorasLectura],
    );

    return rows.map(
      (r): Punto => ({ value: Number(r.valor), time: r.hora.toISOString() }),
    );
  }

  /**
   * Consumo de cada día del rango. Los días cerrados se leen de undurraga_daily_metrics;
   * los que faltan se calculan y se guardan (NULL si no hubo datos). Hoy se calcula
   * siempre y nunca se guarda, para no dejar un valor parcial como definitivo.
   */
  private async diario(sensor: number, dias: string[]): Promise<Punto[]> {
    const hoy = hoyChile();
    const valores = new Map<string, number | null>();

    if (this.tablaDiariaDisponible) {
      try {
        const cacheadas: FilaDia[] = await this.metricRepository.query(
          `SELECT mt_day::text AS dia, mt_value AS valor
           FROM undurraga_daily_metrics
           WHERE sensor_id = $1 AND mt_day BETWEEN $2 AND $3`,
          [sensor, dias[0], dias[dias.length - 1]],
        );
        cacheadas.forEach((f) =>
          valores.set(f.dia, f.valor === null ? null : Number(f.valor)),
        );
      } catch (error) {
        this.desactivarTablaDiaria(error);
      }
    }

    const pendientes = dias.filter((d) => d === hoy || !valores.has(d));
    if (pendientes.length > 0) {
      const calculadas = await this.consumoPorDia(
        sensor,
        pendientes[0],
        pendientes[pendientes.length - 1],
      );
      const aGuardar = pendientes.filter((d) => d < hoy);
      pendientes.forEach((d) => valores.set(d, calculadas.get(d) ?? null));

      if (this.tablaDiariaDisponible && aGuardar.length > 0) {
        try {
          await this.metricRepository.query(
            `INSERT INTO undurraga_daily_metrics (sensor_id, mt_day, mt_value)
             SELECT $1, t.dia::date, t.valor
             FROM unnest($2::text[], $3::float8[]) AS t(dia, valor)
             ON CONFLICT (sensor_id, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
            [sensor, aGuardar, aGuardar.map((d) => calculadas.get(d) ?? null)],
          );
        } catch (error) {
          this.desactivarTablaDiaria(error);
        }
      }
    }

    return dias
      .filter((d) => valores.get(d) != null)
      .map((d) => ({ time: d, value: valores.get(d)! }));
  }

  /**
   * Consumo por día = suma de los incrementos positivos entre lecturas seguidas. Un reinicio
   * del contador (como el diario de la piscina) no resta, y un salto imposible (más que
   * `TOTALIZADOR_MAX_M3H` por el tiempo transcurrido) se descarta. El incremento se asigna
   * al día de la lectura posterior, así que el tramo de medianoche también se cuenta.
   */
  private async consumoPorDia(
    sensor: number,
    desde: string,
    hasta: string,
  ): Promise<Map<string, number>> {
    const filas: FilaDia[] = await this.metricRepository.query(
      `WITH s AS (
         SELECT time, value::float8 AS v,
                LAG(value::float8) OVER (ORDER BY time, id) AS prev,
                LAG(time) OVER (ORDER BY time, id) AS prev_time
         FROM undurraga_metrics
         WHERE sensor_id = $1
           AND time >= ${inicioDia('$2')} - INTERVAL '1 day'
           AND time < ${finDia('$3')}
       )
       SELECT ${diaLocal}::text AS dia,
              COALESCE(SUM(v - prev) FILTER (
                WHERE v > prev
                  AND v - prev <= $4 * GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0.25)
              ), 0) AS valor
       FROM s
       WHERE time >= ${inicioDia('$2')} AND prev IS NOT NULL
       GROUP BY 1`,
      [sensor, desde, hasta, this.maxM3h],
    );
    return new Map(filas.map((f) => [f.dia, Number(f.valor ?? 0)]));
  }

  /** Si la tabla diaria aún no existe (migración pendiente), se calcula sin caché. */
  private desactivarTablaDiaria(error: unknown) {
    if ((error as { code?: string })?.code === '42P01') {
      this.tablaDiariaDisponible = false;
      this.logger.warn(
        'No existe undurraga_daily_metrics: el consumo diario se calcula sin caché. Ejecutar migrations/001-mejoras-2026-11.sql',
      );
      return;
    }
    throw error;
  }
}
