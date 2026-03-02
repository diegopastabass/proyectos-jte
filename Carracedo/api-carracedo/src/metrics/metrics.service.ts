import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

// formatDBDate
const formatDBDate = (date: string | Date): string => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
};

@Injectable()
export class CarracedoService {
  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  // getSnapshot
  async getSnapshot(): Promise<MetricSnapshot> {
    const results = await this.repo.query(`
      SELECT t.mt_name, t.mt_value, t.mt_time_2
      FROM carracedo t
      INNER JOIN (
        SELECT mt_name, MAX(mt_time_2) AS last_time
        FROM carracedo
        GROUP BY mt_name
      ) latest
      ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
    `);

    const prefix = 'CARRACEDO--slave.';

    return results.reduce((acc: MetricSnapshot, row: any) => {
      const key = row.mt_name.replace(prefix, '');
      acc[key] = {
        value: Number(row.mt_value),
        time: formatDBDate(row.mt_time_2),
      };
      return acc;
    }, {});
  }

  // getTotalizador
  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    if (!dto.start || !dto.end)
      throw new Error('Se requiere rango de fechas válido.');

    const start = `${dto.start} 00:00:00`;
    const end = `${dto.end} 23:59:59`;

    const results = await this.repo.query(
      `
        WITH bounds AS (
          SELECT 
            mt_time_2::DATE AS day, 
            MIN(mt_time_2) AS first_ts, 
            MAX(mt_time_2) AS last_ts
          FROM carracedo
          WHERE mt_name = 'CARRACEDO--slave.totalizador'
          AND mt_time_2 BETWEEN $1 AND $2
          GROUP BY mt_time_2::DATE
        )
        SELECT 
          b.day,
          (
            (SELECT CAST(mt_value AS NUMERIC(30,6)) FROM carracedo WHERE mt_name = 'CARRACEDO--slave.totalizador' AND mt_time_2 = b.last_ts LIMIT 1)
            -
            (SELECT CAST(mt_value AS NUMERIC(30,6)) FROM carracedo WHERE mt_name = 'CARRACEDO--slave.totalizador' AND mt_time_2 = b.first_ts LIMIT 1)
          ) AS daily_value
        FROM bounds b
        ORDER BY b.day ASC
      `,
      [start, end],
    );

    return results.map((row: any) => {
      const dateStr =
        row.day instanceof Date
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
          mt_name: 'CARRACEDO--slave.pozo',
          mt_time_2: Between(start, end),
        },
        order: { mt_time_2: 'ASC' },
      });

      return results.map((row) => ({
        time: formatDBDate(row.mt_time_2),
        value: Number(row.mt_value),
      }));
    }

    const results = await this.repo.find({
      where: { mt_name: 'CARRACEDO--slave.pozo' },
      order: { mt_time_2: 'DESC' },
      take: 300,
    });

    return results.reverse().map((row) => ({
      time: formatDBDate(row.mt_time_2),
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
          mt_name: 'CARRACEDO--slave.caudal',
          mt_time_2: Between(start, end),
        },
        order: { mt_time_2: 'ASC' },
      });

      return results.map((row) => ({
        time: formatDBDate(row.mt_time_2),
        value: Number(row.mt_value),
      }));
    }

    const results = await this.repo.find({
      where: { mt_name: 'CARRACEDO--slave.caudal' },
      order: { mt_time_2: 'DESC' },
      take: 300,
    });

    return results.reverse().map((row) => ({
      time: formatDBDate(row.mt_time_2),
      value: Number(row.mt_value),
    }));
  }
}
