import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { Metric } from '../models/metric.entity';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);

  private metricsBuffer: CreateMetricDto[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(Metric)
    private readonly metricRepository: Repository<Metric>,
  ) {}

  onModuleInit() {
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 60000);
  }

  onModuleDestroy() {
    clearInterval(this.flushInterval);
    this.flushMetrics();
  }

  async createMetric(
    dto: CreateMetricDto,
  ): Promise<{ success: boolean; message: string }> {
    this.metricsBuffer.push(dto);

    if (this.metricsBuffer.length >= 100) {
      await this.flushMetrics();
    }

    return { success: true, message: 'Metric buffered' };
  }

  private async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    const dataToSave = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      await this.metricRepository
        .createQueryBuilder()
        .insert()
        .into('montes')
        .values(dataToSave)
        .execute();

      this.logger.log(`Bulk inserted ${dataToSave.length} metrics`);
    } catch (error) {
      this.logger.error('Error in bulk insert', error);
    }
  }

  async findLatestForEachName(): Promise<
    Record<string, { value: number; time: Date }>
  > {
    const metrics = await this.metricRepository
      .createQueryBuilder('metric')
      .distinctOn(['metric.name'])
      .orderBy('metric.name')
      .addOrderBy('metric.time', 'DESC')
      .getMany();

    const result: Record<string, { value: number; time: Date }> = {};
    metrics.forEach((metric) => {
      result[metric.name] = {
        value: Number(metric.value),
        time: metric.time,
      };
    });

    return result;
  }

  async getDailyTotalizer(name: string, start: string, end: string) {
    const endOfDay = `${end} 23:59:59`;

    const rawData = await this.metricRepository
      .createQueryBuilder('metric')
      .select('DATE(metric.time)', 'date')
      .addSelect(
        'MAX(metric.value::numeric) - MIN(metric.value::numeric)',
        'usage',
      )
      .where('metric.name = :name', { name })
      .andWhere('metric.time BETWEEN :start AND :end', { start, end: endOfDay })
      .andWhere("metric.value ~ '^[0-9]+(\\.[0-9]+)?$'")
      .groupBy('DATE(metric.time)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return rawData.map((item) => ({
      value: parseFloat(item.usage),
      time: new Date(item.date).toISOString(),
    }));
  }

  async getHourlyTotalizer(name: string, start?: string, end?: string) {
    let startDate = start;
    let endDate = end;

    if (!startDate || !endDate) {
      const now = new Date();
      const yesterday = new Date();
      yesterday.setHours(now.getHours() - 24);

      startDate = yesterday.toISOString();
      endDate = now.toISOString();
    } else {
      endDate = `${end} 23:59:59`;
    }

    const rawData = await this.metricRepository
      .createQueryBuilder('metric')
      .select("DATE_TRUNC('hour', metric.time)", 'hour_group')
      .addSelect(
        'MAX(metric.value::numeric) - MIN(metric.value::numeric)',
        'usage',
      )
      .where('metric.name = :name', { name })
      .andWhere('metric.time BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere("metric.value ~ '^[0-9]+(\\.[0-9]+)?$'")
      .groupBy("DATE_TRUNC('hour', metric.time)")
      .orderBy('hour_group', 'ASC')
      .getRawMany();

    return rawData.map((item) => ({
      value: parseFloat(item.usage),
      time: new Date(item.hour_group).toISOString(),
    }));
  }

  async getFlowRate(name: string, start?: string, end?: string) {
    const query = this.metricRepository
      .createQueryBuilder('metric')
      .select(['metric.value', 'metric.time'])
      .where('metric.name = :name', { name })
      .andWhere("metric.value ~ '^[0-9]+(\\.[0-9]+)?$'");

    if (start && end) {
      const endOfDay = `${end} 23:59:59`;
      query
        .andWhere('metric.time BETWEEN :start AND :end', {
          start,
          end: endOfDay,
        })
        .orderBy('metric.time', 'ASC');
    } else {
      query.orderBy('metric.time', 'DESC').take(100);
    }

    const result = await query.getMany();

    if (!start && !end) {
      return result.reverse();
    }

    return result;
  }
}
