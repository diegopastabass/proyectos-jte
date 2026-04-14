import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

@Injectable()
export class SsrQuillayService {
  private readonly logger = new Logger(SsrQuillayService.name);

  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  private normalizeDateRange(
    dto: DateRangeDto,
  ): { start: Date; end: Date } | null {
    try {
      if (!dto.start || !dto.end) return null;

      const startDate = new Date(`${dto.start}T00:00:00Z`);
      const nextDay = new Date(dto.end);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const endDate = new Date(
        `${nextDay.toISOString().slice(0, 10)}T00:00:00Z`,
      );

      return { start: startDate, end: endDate };
    } catch (error) {
      this.logger.error(
        `Error in normalizeDateRange: ${error.message}`,
        error?.stack,
      );
      throw error;
    }
  }

  // Snapshot
  async getSnapshot(): Promise<{
    snapshot: MetricSnapshot;
    tiempo_vaciado_hormigon: number;
    tiempo_vaciado_hormigon_formatted: string;
    tiempo_vaciado_metalico: number;
    tiempo_vaciado_metalico_formatted: string;
  }> {
    try {
      const results = await this.repo.query(`
      SELECT t.mt_name, t.mt_value, t.mt_time_2
      FROM ssr_quillay t
      INNER JOIN (
        SELECT mt_name, MAX(mt_time_2) AS last_time
        FROM ssr_quillay
        GROUP BY mt_name
      ) latest
      ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
    `);

      const prefix = 'SSR_QUILLAY--slave.';

      const snapshot: MetricSnapshot = results.reduce(
        (acc: MetricSnapshot, row: any) => {
          const key = row.mt_name.replace(prefix, '');
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

      const hormigon = await calcularTiempoVaciado(
        'SSR_QUILLAY--slave.estanque_hormigon',
      );
      const metalico = await calcularTiempoVaciado(
        'SSR_QUILLAY--slave.estanque_metalico',
      );

      return {
        snapshot,
        tiempo_vaciado_hormigon: hormigon.tiempo,
        tiempo_vaciado_hormigon_formatted: hormigon.formatted,
        tiempo_vaciado_metalico: metalico.tiempo,
        tiempo_vaciado_metalico_formatted: metalico.formatted,
      };
    } catch (error) {
      this.logger.error(`Error in getSnapshot: ${error.message}`, error?.stack);
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
        `SELECT mt_day, mt_value FROM ssr_quillay_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
        [metricName, start, end],
      );

      const metricsMap = new Map<string, number>();
      cached.forEach((row: any) => {
        const dateStr =
          typeof row.mt_day === 'string'
            ? row.mt_day
            : row.mt_day.toString().split('T')[0];
        metricsMap.set(dateStr, Number(row.mt_value));
      });

      const missingDates: string[] = [];
      let currentDate = new Date(`${start}T00:00:00Z`);
      const endDate = new Date(`${end}T00:00:00Z`);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!metricsMap.has(dateStr)) {
          missingDates.push(dateStr);
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      if (missingDates.length > 0) {
        const calculated = await this.repo.query(
          `
          WITH bounds AS (
            SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
            FROM ssr_quillay
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day,
            (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_quillay s_first
            ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_quillay s_last
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
            `INSERT INTO ssr_quillay_daily_metrics (mt_name, mt_day, mt_value) 
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
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      return results;
    } catch (error) {
      this.logger.error(
        `Error in calculateAndCacheDaily para ${metricName}: ${error.message}`,
        error?.stack,
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
        'SSR_QUILLAY--slave.totalizador',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error(
        `Error in getTotalizador: ${error.message}`,
        error?.stack,
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
        'SSR_QUILLAY--slave.horometro',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error(
        `Error in getHorometro: ${error.message}`,
        error?.stack,
      );
      throw error;
    }
  }

  // Kwh
  async getKwh(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto || !dto.start || !dto.end)
        throw new Error('Se requiere rango de fechas válido.');
      return await this.calculateAndCacheDaily(
        'SSR_QUILLAY--slave.kwh',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error(`Error in getKwh: ${error.message}`, error?.stack);
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
            mt_name: 'SSR_QUILLAY--slave.estanque_hormigon',
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
        where: { mt_name: 'SSR_QUILLAY--slave.estanque_hormigon' },
        order: { mt_time_2: 'DESC' },
        take: takeLimit,
      });

      return results.reverse().map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    } catch (error) {
      this.logger.error(`Error in getNivel: ${error.message}`, error?.stack);
      throw error;
    }
  }

  // Nivel 2
  async getNivel2(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);

      if (range) {
        const { start, end } = range;
        const results = await this.repo.find({
          where: {
            mt_name: 'SSR_QUILLAY--slave.estanque_metalico',
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
        where: { mt_name: 'SSR_QUILLAY--slave.estanque_metalico' },
        order: { mt_time_2: 'DESC' },
        take: takeLimit,
      });

      return results.reverse().map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    } catch (error) {
      this.logger.error(`Error in getNivel2: ${error.message}`, error?.stack);
      throw error;
    }
  }

  // Corriente
  async getCorriente(dto: DateRangeDto): Promise<{ i1: Metric[] }> {
    try {
      const range = this.normalizeDateRange(dto);

      const fetchVariable = async (variable: string) => {
        const mtName = `SSR_QUILLAY--slave.${variable}`;
        if (!range) {
          const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
          const results = await this.repo.find({
            where: {
              mt_name: mtName,
              mt_time_2: Raw((alias) => `${alias} >= :start`, { start }),
            },
            order: { mt_time_2: 'ASC' },
          });

          return results.map((row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
          }));
        }

        const { start, end } = range;

        const results = await this.repo.find({
          where: {
            mt_name: mtName,
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
      };

      const [i1] = await Promise.all([fetchVariable('i1')]);

      return { i1 };
    } catch (error) {
      this.logger.error(
        `Error in getCorriente: ${error.message}`,
        error?.stack,
      );
      throw error;
    }
  }

  // Voltaje
  async getVoltaje(dto: DateRangeDto): Promise<{ v1: Metric[] }> {
    try {
      const range = this.normalizeDateRange(dto);

      const fetchVariable = async (variable: string) => {
        const mtName = `SSR_QUILLAY--slave.${variable}`;
        if (!range) {
          const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
          const results = await this.repo.find({
            where: {
              mt_name: mtName,
              mt_time_2: Raw((alias) => `${alias} >= :start`, { start }),
            },
            order: { mt_time_2: 'ASC' },
          });

          return results.map((row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
          }));
        }

        const { start, end } = range;

        const results = await this.repo.find({
          where: {
            mt_name: mtName,
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
      };

      const [v1] = await Promise.all([fetchVariable('v1')]);

      return { v1 };
    } catch (error) {
      this.logger.error(`Error in getVoltaje: ${error.message}`, error?.stack);
      throw error;
    }
  }

  // Presion
  async getPresion(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (!range) {
        const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const results = await this.repo.find({
          where: {
            mt_name: 'SSR_QUILLAY--slave.presion',
            mt_time_2: Raw((alias) => `${alias} >= :start`, { start }),
          },
          order: { mt_time_2: 'ASC' },
        });

        return results.map((row) => ({
          time: row.mt_time_2.toISOString(),
          value: Number(row.mt_value),
        }));
      }

      const { start, end } = range;

      const results = await this.repo.find({
        where: {
          mt_name: 'SSR_QUILLAY--slave.presion',
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
    } catch (error) {
      this.logger.error(`Error in getPresion: ${error.message}`, error?.stack);
      throw error;
    }
  }

  // Caudal
  async getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);

      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: 'SSR_QUILLAY--slave.caudal' },
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
          mt_name: 'SSR_QUILLAY--slave.caudal',
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
    } catch (error) {
      this.logger.error(`Error in getCaudal: ${error.message}`, error?.stack);
      throw error;
    }
  }
}
