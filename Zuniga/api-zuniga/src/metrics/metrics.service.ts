import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

@Injectable()
export class SsrZunigaService {
  private readonly logger = new Logger(SsrZunigaService.name);

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

  async getSnapshotCumpeo() {
    try {
      const results = await this.repo.query(`
        SELECT t.name, t.value, t.insert_time
        FROM ssr_cumpeo t
        INNER JOIN (
          SELECT name, MAX(insert_time) AS last_time
          FROM ssr_cumpeo
          GROUP BY name
        ) latest
        ON t.name = latest.name AND t.insert_time = latest.last_time
      `);

      const snapshot: MetricSnapshot = results.reduce(
        (acc: MetricSnapshot, row: any) => {
          acc[row.name] = {
            value: Number(row.value),
            time: new Date(row.insert_time).toISOString(),
          };
          return acc;
        },
        {},
      );

      const calcularTiempoVaciado = async (nombreEstanque: string) => {
        const mediciones: { value: string; insert_time: string }[] =
          await this.repo.query(
            `SELECT value, insert_time FROM ssr_cumpeo WHERE name = $1 ORDER BY insert_time DESC LIMIT 2`,
            [nombreEstanque],
          );
        if (mediciones.length < 2)
          return { tiempo: 0, formatted: 'Llenando...' };
        const [actual, anterior] = mediciones;
        const [nivel_actual, nivel_anterior] = [
          Number(actual.value),
          Number(anterior.value),
        ];
        const [t_actual, t_anterior] = [
          new Date(actual.insert_time).getTime() / 1000,
          new Date(anterior.insert_time).getTime() / 1000,
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

      const estanque = await calcularTiempoVaciado('NIVEL');
      return {
        snapshot,
        tiempo_vaciado: estanque.tiempo,
        tiempo_vaciado_formatted: estanque.formatted,
      };
    } catch (error) {
      this.logger.error('Error en getSnapshotCumpeo', error);
      throw error;
    }
  }

  async getSnapshot() {
    try {
      const results = await this.repo.query(`
        SELECT t.mt_name, t.mt_value, t.mt_time_2
        FROM ssr_zuniga t
        INNER JOIN (
          SELECT mt_name, MAX(mt_time_2) AS last_time
          FROM ssr_zuniga
          GROUP BY mt_name
        ) latest
        ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
      `);

      const prefix = 'SSR_ZUNIGA--slave.';
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
        'SSR_ZUNIGA--slave.estanque',
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
        `SELECT mt_day, mt_value FROM ssr_zuniga_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
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
            FROM ssr_zuniga
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day, (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_zuniga s_first ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_zuniga s_last ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
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
            `INSERT INTO ssr_zuniga_daily_metrics (mt_name, mt_day, mt_value) VALUES ($1, $2, $3) ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
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
        'SSR_ZUNIGA--slave.totalizador',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error('Error en getTotalizador', error);
      throw error;
    }
  }

  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango inválido');
      return await this.calculateAndCacheDaily(
        'SSR_ZUNIGA--slave.horometro',
        dto.start,
        dto.end,
      );
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
            mt_name: 'SSR_ZUNIGA--slave.estanque',
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
        where: { mt_name: 'SSR_ZUNIGA--slave.estanque' },
        order: { mt_time_2: 'DESC' },
        take: dto.limit ? Number(dto.limit) : 100,
      });
      return results
        .reverse()
        .map((r) => ({
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
            mt_name: 'SSR_ZUNIGA--slave.estanque_2',
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
        where: { mt_name: 'SSR_ZUNIGA--slave.estanque_2' },
        order: { mt_time_2: 'DESC' },
        take: dto.limit ? Number(dto.limit) : 100,
      });
      return results
        .reverse()
        .map((r) => ({
          time: r.mt_time_2.toISOString(),
          value: Number(r.mt_value),
        }));
    } catch (error) {
      this.logger.error('Error en getNivel2', error);
      throw error;
    }
  }

  async getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: 'SSR_ZUNIGA--slave.caudal' },
          order: { mt_time_2: 'DESC' },
          take: 100,
        });
        return results
          .reverse()
          .map((r) => ({
            time: r.mt_time_2.toISOString(),
            value: Number(r.mt_value),
          }));
      }
      const results = await this.repo.find({
        where: {
          mt_name: 'SSR_ZUNIGA--slave.caudal',
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
    } catch (error) {
      this.logger.error('Error en getCaudal', error);
      throw error;
    }
  }
}
