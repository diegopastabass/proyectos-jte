import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

@Injectable()
export class SsrCompaniaService {
  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  private normalizeDateRange(
    dto: DateRangeDto,
  ): { start: Date; end: Date } | null {
    if (!dto.start || !dto.end) return null;

    const startDate = new Date(`${dto.start}T00:00:00Z`);
    const nextDay = new Date(`${dto.end}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const endDate = new Date(`${nextDay.toISOString().slice(0, 10)}T00:00:00Z`);

    return { start: startDate, end: endDate };
  }

  // Snapshot
  async getSnapshot(): Promise<{
    snapshot: MetricSnapshot;
    tiempo_vaciado: number;
    tiempo_vaciado_formatted: string;
  }> {
    const results = await this.repo.query(`
    SELECT t.mt_name, t.mt_value, t.mt_time_2
    FROM ssr_compania t
    INNER JOIN (
      SELECT mt_name, MAX(mt_time_2) AS last_time
      FROM ssr_compania
      GROUP BY mt_name
    ) latest
    ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
  `);

    const snapshot: MetricSnapshot = results.reduce(
      (acc: MetricSnapshot, row: any) => {
        const key = row.mt_name;
        acc[key] = {
          value: Number(row.mt_value),
          time: new Date(row.mt_time_2).toISOString(),
        };
        return acc;
      },
      {},
    );

    const calcularTiempoVaciado = async (nombreEstanque: string) => {
      const mediciones = await this.repo.find({
        where: { mt_name: nombreEstanque },
        order: { mt_time_2: 'DESC' },
        take: 2,
      });

      if (mediciones.length < 2) {
        return { tiempo: 0, formatted: 'Llenando...' };
      }

      const [actual, anterior] = mediciones;
      const nivel_actual = Number(actual.mt_value);
      const nivel_anterior = Number(anterior.mt_value);

      const t_actual = actual.mt_time_2.getTime() / 1000;
      const t_anterior = anterior.mt_time_2.getTime() / 1000;

      if (!(nivel_actual < nivel_anterior && t_actual > t_anterior)) {
        return { tiempo: 0, formatted: 'Llenando...' };
      }

      const tasa_vaciado =
        (nivel_anterior - nivel_actual) / (t_actual - t_anterior);
      const tiempo = Math.round(nivel_actual / tasa_vaciado);

      const h = Math.floor(tiempo / 3600);
      const m = Math.floor((tiempo % 3600) / 60);
      const s = tiempo % 60;

      const formatted = `${h.toString().padStart(2, '0')} h ${m
        .toString()
        .padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`;

      return { tiempo, formatted };
    };

    const estanque = await calcularTiempoVaciado('SALA_BOMBAS_NIVEL_METROS');

    return {
      snapshot,
      tiempo_vaciado: estanque.tiempo,
      tiempo_vaciado_formatted: estanque.formatted,
    };
  }

  // Nivel
  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);

    if (range) {
      const { start, end } = range;
      const results = await this.repo.find({
        where: {
          mt_name: 'SALA_BOMBAS_NIVEL_METROS',
          mt_time_2: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
            start,
            end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });

      return results.map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    }

    const takeLimit =
      dto.limit && !isNaN(Number(dto.limit)) ? Number(dto.limit) : 100;

    const results = await this.repo.find({
      where: { mt_name: 'SALA_BOMBAS_NIVEL_METROS' },
      order: { mt_time_2: 'DESC' },
      take: takeLimit,
    });

    return results.reverse().map((row) => ({
      time: row.mt_time_2.toISOString(),
      value: Number(row.mt_value),
    }));
  }

  // Horometro
  private async calculateAndCacheHorometro(
    start: string,
    end: string,
  ): Promise<Metric[]> {
    const METRIC_NAME = 'HOROMETRO';

    // 1. Buscar en caché
    const cached = await this.repo.query(
      `SELECT mt_day, mt_value FROM ssr_compania_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3 ORDER BY mt_day ASC`,
      [METRIC_NAME, start, end],
    );

    const metricsMap = new Map<string, number>();
    cached.forEach((row: any) => {
      const dateStr =
        typeof row.mt_day === 'string'
          ? row.mt_day.slice(0, 10)
          : (row.mt_day as Date).toISOString().split('T')[0];
      metricsMap.set(dateStr, Number(row.mt_value));
    });

    // 2. Determinar qué días faltan (siempre recalcular desde el último cacheado hasta hoy)
    const todayStr = new Date().toISOString().split('T')[0];

    // Si hay datos en caché, recalcular desde el último día cacheado hasta hoy
    const cachedDates = Array.from(metricsMap.keys()).sort();
    const recalcFrom =
      cachedDates.length > 0
        ? cachedDates[cachedDates.length - 1] // último día cacheado
        : start;

    const missingDates: string[] = [];
    let currentDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      // Incluir días que faltan O el último cacheado (que puede haber cambiado) O el día de hoy
      if (!metricsMap.has(dateStr) || dateStr >= recalcFrom) {
        missingDates.push(dateStr);
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // 3. Calcular los días que faltan usando la lógica de intervalos activos
    if (missingDates.length > 0) {
      const calculated = await this.repo.query(
        `
        WITH events AS (
          SELECT
            (mt_time_2 AT TIME ZONE 'UTC')::DATE AS day,
            mt_time_2,
            CAST(mt_value AS NUMERIC) AS estado,
            LAG(CAST(mt_value AS NUMERIC)) OVER (
              PARTITION BY (mt_time_2 AT TIME ZONE 'UTC')::DATE
              ORDER BY mt_time_2
            ) AS prev_estado,
            LAG(mt_time_2) OVER (
              PARTITION BY (mt_time_2 AT TIME ZONE 'UTC')::DATE
              ORDER BY mt_time_2
            ) AS prev_time
          FROM ssr_compania
          WHERE mt_name = 'SALA_BOMBAS_FUNCIONANDO'
            AND (mt_time_2 AT TIME ZONE 'UTC')::DATE = ANY($1::DATE[])
        ),
        intervals AS (
          SELECT
            day,
            EXTRACT(EPOCH FROM (mt_time_2 - prev_time)) / 60.0 AS minutes
          FROM events
          WHERE estado = 1
            AND prev_estado IS NOT NULL
        )
        SELECT day, COALESCE(SUM(minutes), 0) AS daily_minutes
        FROM intervals
        GROUP BY day
        `,
        [missingDates],
      );

      // Indexar resultados por fecha
      const calcMap = new Map<string, number>();
      for (const row of calculated) {
        const dateStr =
          typeof row.day === 'string'
            ? row.day.slice(0, 10)
            : (row.day as Date).toISOString().split('T')[0];
        calcMap.set(dateStr, Number(row.daily_minutes || 0));
      }

      // Guardar en caché (upsert) y actualizar el mapa local
      for (const dateStr of missingDates) {
        const val = calcMap.get(dateStr) ?? 0;
        await this.repo.query(
          `INSERT INTO ssr_compania_daily_metrics (mt_name, mt_day, mt_value)
           VALUES ($1, $2, $3)
           ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
          [METRIC_NAME, dateStr, val],
        );
        metricsMap.set(dateStr, val);
      }
    }

    // 4. Construir el arreglo de respuesta en orden
    const results: Metric[] = [];
    currentDate = new Date(`${start}T00:00:00Z`);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (metricsMap.has(dateStr)) {
        results.push({
          time: dateStr,
          value: Math.round(metricsMap.get(dateStr)!),
        });
      }
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    return results;
  }

  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    if (!dto || !dto.start || !dto.end)
      throw new Error('Se requiere rango de fechas válido.');
    return this.calculateAndCacheHorometro(dto.start, dto.end);
  }
}
