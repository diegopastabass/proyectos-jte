import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from '../models/metric.entity';

export const SENSORES = {
  caudal: ['montes_riles_caudal', 'montes_general_caudal'],
  totalizador: ['montes_riles_totalizador', 'montes_general_totalizador'],
} as const;

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

/**
 * Las diferencias entre lecturas se calculan ordenando por `id` (orden real de inserción)
 * y no por `time`: en la hora repetida del fin del horario de verano y en cargas con la
 * misma hora, ordenar por `time` intercala lecturas y genera falsos incrementos.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

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
    this.maxM3h = Number(config.get('TOTALIZADOR_MAX_M3H') ?? 200);
    this.maxHorasLectura =
      Number(config.get('INTERVALO_MAX_MINUTOS') ?? 15) / 60;
  }

  private validarSensor(name: string, tipo: TipoSensor) {
    if (!(SENSORES[tipo] as readonly string[]).includes(name)) {
      throw new NotFoundException(`Sensor de ${tipo} desconocido: ${name}`);
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

  async findLatestForEachName(): Promise<
    Record<string, { value: number; time: Date }>
  > {
    const metrics = await this.metricRepository
      .createQueryBuilder('metric')
      .distinctOn(['metric.name'])
      .orderBy('metric.name')
      .addOrderBy('metric.time', 'DESC')
      .addOrderBy('metric.id', 'DESC')
      .getMany();

    const result: Record<string, { value: number; time: Date }> = {};
    metrics.forEach((metric) => {
      result[metric.name] = {
        value: Number(metric.value),
        time: metric.time,
      };
    });

    return result;
  }

  /** Lecturas crudas de caudal del rango de días, o de las últimas 24 h si no hay rango. */
  async getFlowRate(name: string, start?: string, end?: string) {
    this.validarSensor(name, 'caudal');
    const conRango = this.validarRango(start, end);

    const filtro = conRango
      ? 'time >= $2::date AND time < $3::date + 1'
      : "time >= now() - INTERVAL '24 hours'";
    const rows: { time: Date; value: number }[] =
      await this.metricRepository.query(
        `SELECT time, value::float8 AS value
         FROM montes
         WHERE name = $1 AND ${filtro}
         ORDER BY id`,
        conRango ? [name, start, end] : [name],
      );

    return rows.map(
      (r): Punto => ({ value: Number(r.value), time: r.time.toISOString() }),
    );
  }

  /** Consumo diario (m³) del totalizador. Sin rango: últimos 15 días. */
  async getDailyTotalizer(name: string, start?: string, end?: string) {
    this.validarSensor(name, 'totalizador');
    const hoy = hoyChile();
    const conRango = this.validarRango(start, end);
    return this.diario(
      name,
      listarDias(
        conRango ? start! : sumarDias(hoy, -14),
        conRango ? end! : hoy,
      ),
    );
  }

  /** Consumo mensual (m³) de los últimos `meses` meses, incluido el actual. */
  async getMonthlyTotalizer(name: string, meses = 12) {
    this.validarSensor(name, 'totalizador');
    const hoy = hoyChile();
    const inicio = new Date(`${hoy.slice(0, 7)}-01T00:00:00Z`);
    inicio.setUTCMonth(inicio.getUTCMonth() - (meses - 1));
    const dias = await this.diario(
      name,
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
  async getHourlyTotalizer(name: string, start?: string, end?: string) {
    this.validarSensor(name, 'totalizador');
    const conRango = this.validarRango(start, end);
    const desde = conRango ? '$2::date' : "now() - INTERVAL '24 hours'";
    const hasta = conRango ? '$3::date + 1' : 'now()';
    const pmax = conRango ? '$4' : '$2';

    const rows: FilaHora[] = await this.metricRepository.query(
      `WITH s AS (
         SELECT time, value::float8 AS v,
                LAG(value::float8) OVER (ORDER BY id) AS prev,
                LAG(time) OVER (ORDER BY id) AS prev_time
         FROM montes
         WHERE name = $1 AND time >= ${desde} - INTERVAL '1 day' AND time < ${hasta}
       )
       SELECT date_trunc('hour', time) AS hora,
              COALESCE(SUM(v - prev) FILTER (
                WHERE v > prev
                  AND v - prev <= ${pmax} * GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0.25)
              ), 0) AS valor
       FROM s
       WHERE time >= ${desde} AND prev IS NOT NULL
       GROUP BY 1
       ORDER BY 1`,
      conRango ? [name, start, end, this.maxM3h] : [name, this.maxM3h],
    );

    return rows.map(
      (r): Punto => ({ value: Number(r.valor), time: r.hora.toISOString() }),
    );
  }

  /**
   * Volumen por hora (m³) integrando el caudal (m³/h): cada lectura vale por el tiempo
   * transcurrido desde la anterior, con tope `INTERVALO_MAX_MINUTOS` para que una caída
   * no se cuente como horas de caudal. Más fino que el totalizador, que es entero.
   */
  async getHourlyVolumeFromFlow(name: string, start?: string, end?: string) {
    this.validarSensor(name, 'caudal');
    const conRango = this.validarRango(start, end);
    const desde = conRango ? '$2::date' : "now() - INTERVAL '24 hours'";
    const hasta = conRango ? '$3::date + 1' : 'now()';
    const pmax = conRango ? '$4' : '$2';

    const rows: FilaHora[] = await this.metricRepository.query(
      `WITH s AS (
         SELECT time, value::float8 AS v, LAG(time) OVER (ORDER BY id) AS prev_time
         FROM montes
         WHERE name = $1 AND time >= ${desde} - INTERVAL '1 hour' AND time < ${hasta}
       )
       SELECT date_trunc('hour', time) AS hora,
              SUM(v * LEAST(GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0), ${pmax})) AS valor
       FROM s
       WHERE time >= ${desde} AND prev_time IS NOT NULL
       GROUP BY 1
       ORDER BY 1`,
      conRango
        ? [name, start, end, this.maxHorasLectura]
        : [name, this.maxHorasLectura],
    );

    return rows.map(
      (r): Punto => ({ value: Number(r.valor), time: r.hora.toISOString() }),
    );
  }

  /**
   * Consumo de cada día del rango. Los días cerrados se leen de montes_daily_metrics;
   * los que faltan se calculan y se guardan (NULL si no hubo datos). Hoy se calcula
   * siempre y nunca se guarda, para no dejar un valor parcial como definitivo.
   */
  private async diario(name: string, dias: string[]): Promise<Punto[]> {
    const hoy = hoyChile();
    const valores = new Map<string, number | null>();

    if (this.tablaDiariaDisponible) {
      try {
        const cacheadas: FilaDia[] = await this.metricRepository.query(
          `SELECT mt_day::text AS dia, mt_value AS valor
           FROM montes_daily_metrics
           WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
          [name, dias[0], dias[dias.length - 1]],
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
        name,
        pendientes[0],
        pendientes[pendientes.length - 1],
      );
      const aGuardar = pendientes.filter((d) => d < hoy);
      pendientes.forEach((d) => valores.set(d, calculadas.get(d) ?? null));

      if (this.tablaDiariaDisponible && aGuardar.length > 0) {
        try {
          await this.metricRepository.query(
            `INSERT INTO montes_daily_metrics (mt_name, mt_day, mt_value)
             SELECT $1, t.dia::date, t.valor
             FROM unnest($2::text[], $3::float8[]) AS t(dia, valor)
             ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
            [name, aGuardar, aGuardar.map((d) => calculadas.get(d) ?? null)],
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
   * del medidor (bajada) no resta, y un salto imposible (más que `TOTALIZADOR_MAX_M3H` por el
   * tiempo transcurrido) se descarta. El incremento se asigna al día de la lectura posterior,
   * así que el tramo de medianoche también se cuenta.
   */
  private async consumoPorDia(
    name: string,
    desde: string,
    hasta: string,
  ): Promise<Map<string, number>> {
    const filas: FilaDia[] = await this.metricRepository.query(
      `WITH s AS (
         SELECT time, value::float8 AS v,
                LAG(value::float8) OVER (ORDER BY id) AS prev,
                LAG(time) OVER (ORDER BY id) AS prev_time
         FROM montes
         WHERE name = $1 AND time >= $2::date - 1 AND time < $3::date + 1
       )
       SELECT time::date::text AS dia,
              COALESCE(SUM(v - prev) FILTER (
                WHERE v > prev
                  AND v - prev <= $4 * GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0.25)
              ), 0) AS valor
       FROM s
       WHERE time >= $2::date AND prev IS NOT NULL
       GROUP BY 1`,
      [name, desde, hasta, this.maxM3h],
    );
    return new Map(filas.map((f) => [f.dia, Number(f.valor ?? 0)]));
  }

  /** Si la tabla diaria aún no existe (migración pendiente), se calcula sin caché. */
  private desactivarTablaDiaria(error: unknown) {
    if ((error as { code?: string })?.code === '42P01') {
      this.tablaDiariaDisponible = false;
      this.logger.warn(
        'No existe montes_daily_metrics: el consumo diario se calcula sin caché. Ejecutar migrations/001-mejoras-2026-11.sql',
      );
      return;
    }
    throw error;
  }
}
