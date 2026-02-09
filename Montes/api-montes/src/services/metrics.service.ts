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
}
