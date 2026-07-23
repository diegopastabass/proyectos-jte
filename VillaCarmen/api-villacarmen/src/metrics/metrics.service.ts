import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

const client_name = 'ssr_villa_carmen';
const prefix = 'SSR_VILLA_CARMEN--slave.';

@Injectable()
export class SsrMetricsService {
  private readonly logger = new Logger(SsrMetricsService.name);

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
      const results = (await this.repo.query(`
      SELECT t.mt_name, t.mt_value, t.mt_time_2
      FROM ${client_name} t
      INNER JOIN (
        SELECT mt_name, MAX(mt_time_2) AS last_time
        FROM ${client_name}
        GROUP BY mt_name
      ) latest
      ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
    `)) as unknown as {
        mt_name: string;
        mt_value: string;
        mt_time_2: string | Date;
      }[];

      const snapshot: MetricSnapshot = results.reduce(
        (acc: MetricSnapshot, row) => {
          const key = row.mt_name.replace(prefix, '');
          const value = Number(row.mt_value);
          acc[key] = {
            value,
            time: new Date(row.mt_time_2).toISOString(),
          };
          return acc;
        },
        {},
      );

      const calcularTiempoVaciado = async (nombreEstanque: string) => {
        try {
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
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error);
          const errStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `Error en calcularTiempoVaciado para ${nombreEstanque}: ${errMsg}`,
            errStack,
          );
          throw error;
        }
      };

      const est_1 = await calcularTiempoVaciado(`${prefix}estanque`);

      return {
        snapshot,
        tiempo_vaciado: est_1.tiempo,
        tiempo_vaciado_formatted: est_1.formatted,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error en getSnapshot: ${errMsg}`, errStack);
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
      const cached = (await this.repo.query(
        `SELECT mt_day, mt_value FROM ${client_name}_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
        [metricName, start, end],
      )) as unknown as { mt_day: string | Date; mt_value: string | number }[];

      const metricsMap = new Map<string, number>();
      cached.forEach((row) => {
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
        const calculated = (await this.repo.query(
          `
          WITH bounds AS (
            SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
            FROM ${client_name}
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day,
            (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ${client_name} s_first
            ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ${client_name} s_last
            ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
          GROUP BY b.day
          `,
          [metricName, missingDates],
        )) as unknown as {
          day: string | Date;
          daily_value: string | number | null;
        }[];

        for (const row of calculated) {
          const dateStr =
            typeof row.day === 'string'
              ? row.day
              : row.day.toISOString().split('T')[0];
          const val = Number(row.daily_value || 0);

          await this.repo.query(
            `INSERT INTO ${client_name}_daily_metrics (mt_name, mt_day, mt_value) 
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
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error en calculateAndCacheDaily para ${metricName} (${start} a ${end}): ${errMsg}`,
        errStack,
      );
      throw error;
    }
  }

  // Totalizador
  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto || !dto.start || !dto.end)
        throw new Error('Se requiere rango de fechas válido.');
      return await this.calculateAndCacheDaily(
        `${prefix}totalizador`,
        dto.start,
        dto.end,
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error en getTotalizador con DTO ${JSON.stringify(dto)}: ${errMsg}`,
        errStack,
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
        `${prefix}horometro`,
        dto.start,
        dto.end,
      );
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error en getHorometro con DTO ${JSON.stringify(dto)}: ${errMsg}`,
        errStack,
      );
      throw error;
    }
  }

  // Nivel
  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);

      if (range) {
        const { start, end } = range;
        const results = await this.repo.find({
          where: {
            mt_name: `${prefix}estanque`,
            mt_time_2: Raw(
              (alias) => `${alias} >= :start AND ${alias} < :end`,
              {
                start,
                end,
              },
            ),
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
        where: { mt_name: `${prefix}estanque` },
        order: { mt_time_2: 'DESC' },
        take: takeLimit,
      });

      return results.reverse().map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error en getNivel con DTO ${JSON.stringify(dto)}: ${errMsg}`,
        errStack,
      );
      throw error;
    }
  }

  // Caudal
  async getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);

      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: `${prefix}caudal` },
          order: { mt_time_2: 'DESC' },
          take: 100,
        });

        return results.reverse().map((row) => ({
          time: row.mt_time_2.toISOString(),
          value: Number(row.mt_value),
        }));
      }

      const { start, end } = range;

      const results = await this.repo.find({
        where: {
          mt_name: `${prefix}caudal`,
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
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error en getCaudal con DTO ${JSON.stringify(dto)}: ${errMsg}`,
        errStack,
      );
      throw error;
    }
  }
}
