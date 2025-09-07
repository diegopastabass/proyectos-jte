// metrics.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from '../models/metric.entity';
import { CreateMetricDto } from '../models/dto/create-metric.dto';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(Metric)
    private readonly metricRepository: Repository<Metric>,
  ) {}

  async createMetric(dto: CreateMetricDto) {
    try {
      const metric = this.metricRepository.create(dto);
      const result = await this.metricRepository.save(metric);
      this.logger.log(`Inserted metric with id ${result.mt_id}`);
      return { success: true, insertedId: result.mt_id };
    } catch (error) {
      throw new InternalServerErrorException('Error creating metric');
    }
  }

  async getMetrics(limit: number) {
    try {
      return this.metricRepository.find({
        order: { mt_time_2: 'DESC' },
        take: limit,
      });
    } catch (error) {
      throw new InternalServerErrorException('Error fetching latest metrics');
    }
  }

  async findLatestByName(name: string): Promise<Metric | null> {
    try {
      return this.metricRepository.findOne({
        where: { mt_name: name },
        order: { mt_time_2: 'DESC' },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching latest metric by name',
      );
    }
  }

  async findLatestForEachName(): Promise<{
    [key: string]: { value: number; time: string };
  }> {
    try {
      const query = `
        SELECT DISTINCT ON (mt_name) mt_name, mt_value, mt_time_2
        FROM ssr_bucalemu
        ORDER BY mt_name, mt_time_2 DESC;
      `;
      const rows = await this.metricRepository.query(query);

      const result: { [key: string]: { value: number; time: string } } = {};
      rows.forEach((row: any) => {
        result[row.mt_name] = {
          value: parseFloat(row.mt_value),
          time: new Date(row.mt_time_2).toISOString(),
        };
      });
      return result;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching latest metrics for all names',
      );
    }
  }

  async findLastUpdateTime(): Promise<Date | null> {
    try {
      const query = `SELECT MAX(mt_time_2) AS last_update FROM ssr_bucalemu;`;
      const result = await this.metricRepository.query(query);
      return result[0]?.last_update ? new Date(result[0].last_update) : null;
    } catch (error) {
      throw new InternalServerErrorException('Error fetching last update time');
    }
  }

  async estimateEmptyingTimes(): Promise<{ [key: string]: string }> {
    try {
      const query = `
        SELECT t.mt_name, t.mt_value, t.mt_time_2
        FROM (
          SELECT 
            mt_name,
            mt_value,
            mt_time_2,
            ROW_NUMBER() OVER (PARTITION BY mt_name ORDER BY mt_time_2 DESC) AS rn
          FROM ssr_bucalemu
          WHERE mt_name LIKE '%nivel'
        ) t
        WHERE t.rn <= 2
        ORDER BY t.mt_name, t.rn;
      `;
      const rows = await this.metricRepository.query(query);

      const grouped: { [key: string]: { value: number; time: string }[] } = {};
      rows.forEach((row: any) => {
        if (!grouped[row.mt_name]) grouped[row.mt_name] = [];
        grouped[row.mt_name].push({
          value: parseFloat(row.mt_value),
          time: new Date(row.mt_time_2).toISOString(),
        });
      });

      const result: { [key: string]: string } = {};
      for (const name in grouped) {
        const datos = grouped[name];
        if (datos.length < 2) continue;

        const nivel1 = datos[0].value;
        const timestamp1 = datos[0].time;
        const nivel2 = datos[1].value;
        const timestamp2 = datos[1].time;

        const segundos = this.estimateEmptyingTime(
          nivel1,
          timestamp1,
          nivel2,
          timestamp2,
        );

        const key = `t_vaciado_${name.replace(/^ssr_/, '')}`;
        result[key] = isNaN(segundos)
          ? 'NaN'
          : this.formatSecondsToDuration(Math.round(segundos));
      }

      return result;
    } catch (error) {
      throw new InternalServerErrorException('Error estimating emptying times');
    }
  }

  private estimateEmptyingTime(
    level1: number,
    timestamp1: string,
    level2: number,
    timestamp2: string,
  ): number {
    if (isNaN(level1) || isNaN(level2)) {
      return NaN;
    }

    if (level1 >= level2) {
      return 0;
    }

    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    const deltaTimeSeconds = Math.abs(
      (date2.getTime() - date1.getTime()) / 1000,
    );

    if (deltaTimeSeconds === 0) {
      return NaN;
    }

    const lossRate = (level2 - level1) / deltaTimeSeconds;
    return level1 / lossRate;
  }

  private formatSecondsToDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (secs > 0 || result === '') result += `${secs}s`;

    return result.trim();
  }

  async findAllMeasurements() {
    try {
      const query = `
        SELECT mt_name, mt_value, mt_time_2
        FROM (
          SELECT 
            mt_name,
            mt_value,
            mt_time_2,
            ROW_NUMBER() OVER (PARTITION BY mt_name ORDER BY mt_time_2 DESC) as row_num
          FROM ssr_bucalemu
          WHERE mt_name LIKE $1
        ) t
        WHERE row_num <= 100
        ORDER BY mt_name, mt_time_2 ASC;
      `;
      const results = await this.metricRepository.query(query, ['%nivel%']);

      const grouped: Record<string, { mt_value: number; mt_time_2: string }[]> =
        {};

      for (const row of results) {
        const { mt_name, mt_value, mt_time_2 } = row;

        if (!grouped[mt_name]) {
          grouped[mt_name] = [];
        }

        grouped[mt_name].push({
          mt_value: parseFloat(mt_value),
          mt_time_2: this.formatDate(new Date(mt_time_2)),
        });
      }

      return grouped;
    } catch (error) {
      throw new InternalServerErrorException('Error fetching all measurements');
    }
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    return (
      date.getFullYear() +
      '-' +
      pad(date.getMonth() + 1) +
      '-' +
      pad(date.getDate()) +
      ' ' +
      pad(date.getHours()) +
      ':' +
      pad(date.getMinutes()) +
      ':' +
      pad(date.getSeconds())
    );
  }
}
