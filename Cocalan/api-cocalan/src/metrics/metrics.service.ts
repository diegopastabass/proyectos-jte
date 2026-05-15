import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

@Injectable()
export class SsrCocalanService {
  private readonly logger = new Logger(SsrCocalanService.name);

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

  // Snapshot
  async getSnapshot(): Promise<{
    snapshot: MetricSnapshot;
    tiempo_vaciado: number;
    tiempo_vaciado_formatted: string;
  }> {
    try {
      const results = await this.repo.query(`
    SELECT t.mt_name, t.mt_value, t.mt_time_2
    FROM ssr_cocalan t
    INNER JOIN (
      SELECT mt_name, MAX(mt_time_2) AS last_time
      FROM ssr_cocalan
      GROUP BY mt_name
    ) latest
    ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
  `);

      const prefix = 'SSR_COCALAN--slave.';

      const snapshot: MetricSnapshot = results.reduce(
        (acc: MetricSnapshot, row: any) => {
          const key = row.mt_name.replace(prefix, '');
          let value = Number(row.mt_value);

          if (key === 'automatico') {
            value = 1;
          }

          acc[key] = {
            value,
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

      const estanque = await calcularTiempoVaciado('SSR_COCALAN--slave.estanque');

      return {
        snapshot,
        tiempo_vaciado: estanque.tiempo,
        tiempo_vaciado_formatted: estanque.formatted,
      };
    } catch (error) {
      this.logger.error(`Error en getSnapshot: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Daily Metrics
  private async calculateAndCacheDaily(
    metricName: string,
    start: string,
    end: string,
  ): Promise<Metric[]> {
    try {
      const cached = await this.repo.query(
        `SELECT mt_day, mt_value FROM ssr_cocalan_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
        [metricName, start, end],
      );

      const metricsMap = new Map<string, number>();
      cached.forEach((row: any) => {
        const dateStr =
          typeof row.mt_day === 'string'
            ? row.mt_day
            : row.mt_day.toISOString().split('T')[0];
        metricsMap.set(dateStr, Number(row.mt_value));
      });

      const missingDates: string[] = [];
      let currentDate = new Date(`${start}T00:00:00Z`);
      const endDate = new Date(`${end}T00:00:00Z`);
      const todayStr = new Date().toISOString().split('T')[0];

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!metricsMap.has(dateStr) || dateStr === todayStr) {
          missingDates.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (missingDates.length > 0) {
        const calculated = await this.repo.query(
          `
          WITH bounds AS (
            SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
            FROM ssr_cocalan
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day,
            (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_cocalan s_first
            ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_cocalan s_last
            ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
          GROUP BY b.day
          `,
          [metricName, missingDates],
        );

        for (const row of calculated) {
          const dateStr =
            typeof row.day === 'string'
              ? row.day
              : row.day.toISOString().split('T')[0];
          const val = Number(row.daily_value || 0);

          await this.repo.query(
            `INSERT INTO ssr_cocalan_daily_metrics (mt_name, mt_day, mt_value) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
            [metricName, dateStr, val],
          );

          metricsMap.set(dateStr, val);
        }
      }

      const results: Metric[] = [];
      currentDate = new Date(`${start}T00:00:00Z`);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (metricsMap.has(dateStr)) {
          results.push({ time: dateStr, value: metricsMap.get(dateStr)! });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return results;
    } catch (error) {
      this.logger.error(
        `Error en calculateAndCacheDaily para ${metricName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Horometro
  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto || !dto.start || !dto.end)
        throw new Error('Se requiere rango de fechas válido.');
      return await this.calculateAndCacheDaily(
        'SSR_COCALAN--slave.horometro',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error(`Error en getHorometro: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Nivel
  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      const take = dto.limit ? Number(dto.limit) : undefined;

      if (range) {
        const { start, end } = range;
        const results = await this.repo.find({
          where: {
            mt_name: 'SSR_COCALAN--slave.nivel',
            mt_time_2: Raw(
              (alias) => `${alias} >= :start AND ${alias} < :end`,
              {
                start,
                end,
              },
            ),
          },
          order: { mt_time_2: 'ASC' },
          ...(take !== undefined && { take }),
        });

        return results.map((row) => ({
          time: row.mt_time_2.toISOString(),
          value: Number(row.mt_value),
        }));
      }

      // Ultimas 6 horas
      const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const results = await this.repo.find({
        where: {
          mt_name: 'SSR_COCALAN--slave.nivel',
          mt_time_2: Raw((alias) => `${alias} >= :start`, { start }),
        },
        order: { mt_time_2: 'ASC' },
        ...(take !== undefined && { take }),
      });

      return results.map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    } catch (error) {
      this.logger.error(`Error en getNivel: ${error.message}`, error.stack);
      throw error;
    }
  }
}
