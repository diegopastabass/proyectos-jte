import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import * as mysql from 'mysql2/promise';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

@Injectable()
export class SsrTrinidadService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SsrTrinidadService.name);
  private mysqlPool: mysql.Pool;

  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  onModuleInit() {
    this.mysqlPool = mysql.createPool({
      host: process.env.MY_HOST,
      user: process.env.MY_USER,
      password: process.env.MY_PASSWORD,
      database: process.env.MY_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  async onModuleDestroy() {
    if (this.mysqlPool) {
      await this.mysqlPool.end();
    }
  }

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
        FROM ssr_trinidad t
        INNER JOIN (
          SELECT mt_name, MAX(mt_time_2) AS last_time
          FROM ssr_trinidad
          GROUP BY mt_name
        ) latest
        ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
      `);

      const snapshot: MetricSnapshot = results.reduce(
        (acc: MetricSnapshot, row: any) => {
          const key = row.mt_name
            .replace('SSR_TRINIDAD--slave.', '')
            .replace('TK_MARCHIGUE--slave.', '');
          acc[key] = {
            value: Number(row.mt_value),
            time: new Date(row.mt_time_2).toISOString(),
          };
          return acc;
        },
        {},
      );

      const [rows] = await this.mysqlPool.query<mysql.RowDataPacket[]>(`
        SELECT mt_value, mt_time_2 
        FROM apr_marchigue
        WHERE mt_name = 'TK_MARCHIGUE--slave.AI12'
        ORDER BY mt_time_2 DESC
        LIMIT 2;
      `);

      let estanqueTiempo = 0;
      let estanqueFormatted = 'Llenando...';

      if (rows.length > 0) {
        snapshot['estanque'] = {
          value: Number(rows[0].mt_value),
          time: new Date(rows[0].mt_time_2).toISOString(),
        };
      }

      if (rows.length >= 2) {
        const [actual, anterior] = rows;
        const [nivel_actual, nivel_anterior] = [
          Number(actual.mt_value),
          Number(anterior.mt_value),
        ];
        const [t_actual, t_anterior] = [
          new Date(actual.mt_time_2).getTime() / 1000,
          new Date(anterior.mt_time_2).getTime() / 1000,
        ];

        if (nivel_actual < nivel_anterior && t_actual > t_anterior) {
          const tasa_vaciado =
            (nivel_anterior - nivel_actual) / (t_actual - t_anterior);
          const tiempo = Math.round(nivel_actual / tasa_vaciado);
          const h = Math.floor(tiempo / 3600);
          const m = Math.floor((tiempo % 3600) / 60);
          const s = tiempo % 60;
          estanqueTiempo = tiempo;
          estanqueFormatted = `${h.toString().padStart(2, '0')} h ${m.toString().padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`;
        }
      }

      return {
        snapshot,
        tiempo_vaciado: estanqueTiempo,
        tiempo_vaciado_formatted: estanqueFormatted,
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
        `SELECT mt_day, mt_value FROM ssr_trinidad_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
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
            FROM ssr_trinidad
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day, (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_trinidad s_first ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_trinidad s_last ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
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
            `INSERT INTO ssr_trinidad_daily_metrics (mt_name, mt_day, mt_value) VALUES ($1, $2, $3) ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
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

  async getTotalizador_pozo(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango inválido');
      return await this.calculateAndCacheDaily(
        'SSR_TRINIDAD--slave.totalizador_pozo',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error('Error en getTotalizador_pozo', error);
      throw error;
    }
  }

  async getTotalizador_sentina(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango inválido');
      return await this.calculateAndCacheDaily(
        'SSR_TRINIDAD--slave.totalizador_sentina',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error('Error en getTotalizador_sentina', error);
      throw error;
    }
  }

  async getHorometro_e1(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango inválido');
      return await this.calculateAndCacheDaily(
        'SSR_TRINIDAD--slave.horometro_elevadora_1',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error('Error en getHorometro_e1', error);
      throw error;
    }
  }

  async getHorometro_e2(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango inválido');
      return await this.calculateAndCacheDaily(
        'SSR_TRINIDAD--slave.horometro_elevadora_2',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error('Error en getHorometro_e2', error);
      throw error;
    }
  }

  async getHorometro_pozo(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango inválido');
      return await this.calculateAndCacheDaily(
        'SSR_TRINIDAD--slave.horometro_bomba_pozo',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error('Error en getHorometro_pozo', error);
      throw error;
    }
  }

  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (range) {
        const [rows] = await this.mysqlPool.query<mysql.RowDataPacket[]>(
          `SELECT mt_value, mt_time_2 
           FROM apr_marchigue 
           WHERE mt_name = 'TK_MARCHIGUE--slave.AI12' 
             AND mt_time_2 >= ? AND mt_time_2 < ?
           ORDER BY mt_time_2 ASC`,
          [range.start, range.end],
        );
        return rows.map((r) => ({
          time: new Date(r.mt_time_2).toISOString(),
          value: Number(r.mt_value),
        }));
      }

      const limit = dto.limit ? Number(dto.limit) : 100;
      const [rows] = await this.mysqlPool.query<mysql.RowDataPacket[]>(
        `SELECT mt_value, mt_time_2 
         FROM apr_marchigue 
         WHERE mt_name = 'TK_MARCHIGUE--slave.AI12' 
         ORDER BY mt_time_2 DESC 
         LIMIT ?`,
        [limit],
      );
      return rows.reverse().map((r) => ({
        time: new Date(r.mt_time_2).toISOString(),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error('Error en getNivel', error);
      throw error;
    }
  }

  async getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: 'SSR_TRINIDAD--slave.caudal_pozo' },
          order: { mt_time_2: 'DESC' },
          take: 100,
        });
        return results.reverse().map((r) => ({
          time: r.mt_time_2.toISOString(),
          value: Number(r.mt_value),
        }));
      }
      const results = await this.repo.find({
        where: {
          mt_name: 'SSR_TRINIDAD--slave.caudal_pozo',
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
