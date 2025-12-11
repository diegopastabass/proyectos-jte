import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

@Injectable()
export class SSRAmigosService {
  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  // getSnapshot
  async getSnapshot(): Promise<MetricSnapshot> {
    const results = await this.repo.query(`
      SELECT t.mt_name, t.mt_value, t.mt_time_2
      FROM ssr_amigos t
      INNER JOIN (
        SELECT mt_name, MAX(mt_time_2) AS last_time
        FROM ssr_amigos
        GROUP BY mt_name
      ) latest
      ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
    `);

    const prefix = 'SSR_AMIGOS--slave.';

    return results.reduce((acc: MetricSnapshot, row: any) => {
      const key = row.mt_name.replace(prefix, '');
      acc[key] = {
        value: Number(row.mt_value),
        time: new Date(row.mt_time_2).toISOString(),
      };
      return acc;
    }, {});
  }

  // getTotalizador (Corregido)
  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    if (!dto.start || !dto.end) throw new Error('Se requiere rango de fechas válido.');

    const start = `${dto.start} 00:00:00`;
    const end = `${dto.end} 23:59:59`;

    const results = await this.repo.query(
      `
        WITH bounds AS (
          SELECT 
            DATE(mt_time_2) AS day, 
            MIN(mt_time_2) AS first_ts, 
            MAX(mt_time_2) AS last_ts
          FROM ssr_amigos
          WHERE mt_name = 'SSR_AMIGOS--slave.totalizador'
          AND mt_time_2 BETWEEN ? AND ?
          GROUP BY DATE(mt_time_2)
        )
        SELECT 
          b.day,
          (
            (SELECT CAST(mt_value AS DECIMAL(30,6)) FROM ssr_amigos WHERE mt_name = 'SSR_AMIGOS--slave.totalizador' AND mt_time_2 = b.last_ts LIMIT 1)
            -
            (SELECT CAST(mt_value AS DECIMAL(30,6)) FROM ssr_amigos WHERE mt_name = 'SSR_AMIGOS--slave.totalizador' AND mt_time_2 = b.first_ts LIMIT 1)
          ) AS daily_value
        FROM bounds b
        ORDER BY b.day ASC
      `,
      [start, end],
    );

    return results.map((row: any) => {
      const dateStr = row.day instanceof Date 
        ? row.day.toISOString().split('T')[0] 
        : String(row.day);

      return {
        time: dateStr,
        value: Number(row.daily_value || 0), 
      };
    });
  }
  

  // getNivel
  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    const hasRange = dto.start && dto.end;

    if (hasRange) {
      const start = new Date(`${dto.start}T00:00:00`);
      const end = new Date(`${dto.end}T23:59:59`);

      const results = await this.repo.find({
        where: {
          mt_name: 'SSR_AMIGOS--slave.pozo',
          mt_time_2: Between(start, end),
        },
        order: { mt_time_2: 'ASC' }, 
      });

      return results.map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    }

    // Sin rango: últimos 300
    const results = await this.repo.find({
      where: { mt_name: 'SSR_AMIGOS--slave.pozo' },
      order: { mt_time_2: 'DESC' },
      take: 300,
    });

    return results.reverse().map((row) => ({
      time: row.mt_time_2.toISOString(),
      value: Number(row.mt_value),
    }));
  }

  // getCaudal
  async getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    const hasRange = dto.start && dto.end;

    if (hasRange) {
      const start = new Date(`${dto.start}T00:00:00`);
      const end = new Date(`${dto.end}T23:59:59`);

      const results = await this.repo.find({
        where: {
          mt_name: 'SSR_AMIGOS--slave.caudal',
          mt_time_2: Between(start, end),
        },
        order: { mt_time_2: 'ASC' },
      });

      return results.map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    }

    // Sin rango: últimos 300
    const results = await this.repo.find({
      where: { mt_name: 'SSR_AMIGOS--slave.caudal' },
      order: { mt_time_2: 'DESC' },
      take: 300,
    });

    return results.reverse().map((row) => ({
      time: row.mt_time_2.toISOString(),
      value: Number(row.mt_value),
    }));
  }
}