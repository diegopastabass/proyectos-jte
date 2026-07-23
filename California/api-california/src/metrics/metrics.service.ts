import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

@Injectable()
export class SsrCaliforniaService {
  private readonly logger = new Logger(SsrCaliforniaService.name);

  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  private normalizeDateRange(
    dto: DateRangeDto,
  ): { start: Date; end: Date } | null {
    if (!dto.start || !dto.end) return null;
    const startDate = new Date(`${dto.start}T00:00:00Z`);
    const nextDay = new Date(dto.end);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDate = new Date(`${nextDay.toISOString().slice(0, 10)}T00:00:00Z`);
    return { start: startDate, end: endDate };
  }

  async getSnapshot() {
    try {
      const results = await this.repo.query(`
        SELECT t.mt_name, t.mt_value, t.mt_time_2
        FROM ssr_california t
        INNER JOIN (
          SELECT mt_name, MAX(mt_time_2) AS last_time
          FROM ssr_california
          GROUP BY mt_name
        ) latest
        ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
      `);

      const prefix = 'SALA_BOMBA_';
      const snapshot: MetricSnapshot = results.reduce(
        (acc: MetricSnapshot, row: any) => {
          acc[row.mt_name.replace(prefix, '')] = {
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
        if (mediciones.length < 2)
          return { tiempo: 0, formatted: 'Llenando...' };
        const [actual, anterior] = mediciones;
        const [nivel_actual, nivel_anterior] = [
          Number(actual.mt_value),
          Number(anterior.mt_value),
        ];
        const [t_actual, t_anterior] = [
          actual.mt_time_2.getTime() / 1000,
          anterior.mt_time_2.getTime() / 1000,
        ];
        if (!(nivel_actual < nivel_anterior && t_actual > t_anterior))
          return { tiempo: 0, formatted: 'Llenando...' };
        const tasa_vaciado =
          (nivel_anterior - nivel_actual) / (t_actual - t_anterior);
        const tiempo = Math.round(nivel_actual / tasa_vaciado);
        const h = Math.floor(tiempo / 3600);
        const m = Math.floor((tiempo % 3600) / 60);
        const s = tiempo % 60;
        return {
          tiempo,
          formatted: `${h.toString().padStart(2, '0')} h ${m.toString().padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`,
        };
      };

      const estanque = await calcularTiempoVaciado(
        'SSR_CALIFORNIA--slave.estanque',
      );
      return {
        snapshot,
        tiempo_vaciado: estanque.tiempo,
        tiempo_vaciado_formatted: estanque.formatted,
      };
    } catch (error) {
      this.logger.error('Error en getSnapshot', error);
      throw error;
    }
  }

  private async calculateAndCacheDaily(
    metricName: string,
    start: string,
    end: string,
  ): Promise<Metric[]> {
    try {
      const cached = await this.repo.query(
        `SELECT mt_day, mt_value FROM ssr_california_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
        [metricName, start, end],
      );

      const metricsMap = new Map<string, number>();
      cached.forEach((row: any) =>
        metricsMap.set(
          typeof row.mt_day === 'string'
            ? row.mt_day
            : row.mt_day.toISOString().split('T')[0],
          Number(row.mt_value),
        ),
      );

      const missingDates: string[] = [];
      let currentDate = new Date(`${start}T00:00:00Z`);
      const endDate = new Date(`${end}T00:00:00Z`);
      const todayStr = new Date().toISOString().split('T')[0];

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!metricsMap.has(dateStr) || dateStr === todayStr)
          missingDates.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (missingDates.length > 0) {
        const calculated = await this.repo.query(
          `
          WITH bounds AS (
            SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
            FROM ssr_california
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day, (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_california s_first ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_california s_last ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
          GROUP BY b.day
        `,
          [metricName, missingDates],
        );

        for (const row of calculated) {
          const dateStr =
            typeof row.day === 'string'
              ? row.day
              : row.day.toISOString().split('T')[0];
          await this.repo.query(
            `INSERT INTO ssr_california_daily_metrics (mt_name, mt_day, mt_value) VALUES ($1, $2, $3) ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
            [metricName, dateStr, Number(row.daily_value || 0)],
          );
          metricsMap.set(dateStr, Number(row.daily_value || 0));
        }
      }

      const results: Metric[] = [];
      currentDate = new Date(`${start}T00:00:00Z`);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (metricsMap.has(dateStr))
          results.push({ time: dateStr, value: metricsMap.get(dateStr)! });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return results;
    } catch (error) {
      this.logger.error(
        `Error en calculateAndCacheDaily para ${metricName}`,
        error,
      );
      throw error;
    }
  }

  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango inválido');
      return await this.calculateAndCacheDaily(
        'SSR_CALIFORNIA--slave.totalizador',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error('Error en getTotalizador', error);
      throw error;
    }
  }

  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    const CACHE_KEY = 'SALA_BOMBA_BOMBA_horometro';
    const PUMP_METRIC = 'SALA_BOMBA_BOMBA';

    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango inválido');

      const start = dto.start;
      const end = dto.end;

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // 1. Consultar caché para todo el rango
      const cached = await this.repo.query(
        `SELECT mt_day, mt_value
         FROM ssr_california_daily_metrics
         WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
        [CACHE_KEY, start, end],
      );

      const metricsMap = new Map<string, number>();
      cached.forEach((row: any) =>
        metricsMap.set(
          typeof row.mt_day === 'string'
            ? row.mt_day
            : row.mt_day.toISOString().split('T')[0],
          Number(row.mt_value),
        ),
      );

      // 2. Determinar qué días hay que calcular:
      //    - Días sin caché
      //    - Siempre hoy y ayer (verificación de veracidad)
      const datesToCalculate: string[] = [];
      let cursor = new Date(`${start}T00:00:00Z`);
      const endDate = new Date(`${end}T00:00:00Z`);

      while (cursor <= endDate) {
        const dateStr = cursor.toISOString().split('T')[0];
        if (
          !metricsMap.has(dateStr) ||
          dateStr === todayStr ||
          dateStr === yesterdayStr
        ) {
          datesToCalculate.push(dateStr);
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      // 3. Calcular horómetro para los días pendientes
      //    Lógica: por cada registro donde mt_value='1', sumar el tiempo hasta
      //    el registro siguiente del mismo día (LEAD). La suma = minutos activos.
      if (datesToCalculate.length > 0) {
        const calculated: { day: Date | string; total_minutes: number }[] =
          await this.repo.query(
            `
            WITH pump_data AS (
              SELECT
                mt_time_2::DATE                                            AS day,
                mt_time_2,
                CASE WHEN mt_value = '1' THEN 1 ELSE 0 END                AS state,
                LEAD(mt_time_2) OVER (
                  PARTITION BY mt_time_2::DATE ORDER BY mt_time_2
                )                                                          AS next_ts
              FROM ssr_california
              WHERE mt_name = $1
                AND mt_time_2::DATE = ANY($2::DATE[])
            )
            SELECT
              day,
              ROUND(
                COALESCE(
                  SUM(
                    CASE
                      WHEN state = 1 AND next_ts IS NOT NULL
                      THEN EXTRACT(EPOCH FROM (next_ts - mt_time_2)) / 60.0
                      ELSE 0
                    END
                  ), 0
                )
              ) AS total_minutes
            FROM pump_data
            GROUP BY day
            ORDER BY day ASC
            `,
            [PUMP_METRIC, datesToCalculate],
          );

        // 4. Persistir resultados frescos en caché (los datos frescos tienen
        //    prioridad: ON CONFLICT DO UPDATE sobreescribe el valor anterior)
        for (const row of calculated) {
          const dateStr =
            typeof row.day === 'string'
              ? row.day
              : (row.day as Date).toISOString().split('T')[0];
          const seconds = Number(row.total_minutes ?? 0);

          await this.repo.query(
            `INSERT INTO ssr_california_daily_metrics (mt_name, mt_day, mt_value)
             VALUES ($1, $2, $3)
             ON CONFLICT (mt_name, mt_day)
             DO UPDATE SET mt_value = EXCLUDED.mt_value`,
            [CACHE_KEY, dateStr, seconds],
          );
          metricsMap.set(dateStr, seconds);
        }
      }

      // 5. Construir respuesta ordenada para todo el rango solicitado
      const results: Metric[] = [];
      cursor = new Date(`${start}T00:00:00Z`);
      while (cursor <= endDate) {
        const dateStr = cursor.toISOString().split('T')[0];
        results.push({
          time: dateStr,
          value: metricsMap.get(dateStr) ?? 0,
        });
        cursor.setDate(cursor.getDate() + 1);
      }

      return results;
    } catch (error) {
      this.logger.error('Error en getHorometro', error);
      throw error;
    }
  }

  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (range) {
        const results = await this.repo.find({
          where: {
            mt_name: 'SALA_BOMBA_NIVEL_METALICO',
            mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
              start: range.start,
              end: range.end,
            }),
          },
          order: { mt_time_2: 'ASC' },
        });
        return results.map((r) => ({
          time: r.mt_time_2.toISOString(),
          value: Number(r.mt_value),
        }));
      }
      const results = await this.repo.find({
        where: { mt_name: 'SALA_BOMBA_NIVEL_METALICO' },
        order: { mt_time_2: 'DESC' },
        take: dto.limit ? Number(dto.limit) : 100,
      });
      return results.reverse().map((r) => ({
        time: r.mt_time_2.toISOString(),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error('Error en getNivel', error);
      throw error;
    }
  }

  async getNivel2(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (range) {
        const results = await this.repo.find({
          where: {
            mt_name: 'SALA_BOMBA_NIVEL_CERRO',
            mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
              start: range.start,
              end: range.end,
            }),
          },
          order: { mt_time_2: 'ASC' },
        });
        return results.map((r) => ({
          time: r.mt_time_2.toISOString(),
          value: Number(r.mt_value),
        }));
      }
      const results = await this.repo.find({
        where: { mt_name: 'SALA_BOMBA_NIVEL_CERRO' },
        order: { mt_time_2: 'DESC' },
        take: dto.limit ? Number(dto.limit) : 100,
      });
      return results.reverse().map((r) => ({
        time: r.mt_time_2.toISOString(),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error('Error en getNivel2', error);
      throw error;
    }
  }
}
