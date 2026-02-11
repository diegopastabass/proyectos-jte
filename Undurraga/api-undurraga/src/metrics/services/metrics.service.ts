import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Metric } from '../models/metric.entity';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import {
  SnapshotResponse,
  TotalizadorResponse,
} from '../models/metric.response';

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
    }, 30000);
  }

  onModuleDestroy() {
    clearInterval(this.flushInterval);
    this.flushMetrics();
  }

  async createMetric(
    dto: CreateMetricDto,
  ): Promise<{ success: boolean; message: string }> {
    if (!dto.sensor_id || dto.value === undefined || dto.value === null) {
      throw new Error(
        'Debe proporcionar sensor_id y value para insertar un nuevo registro.',
      );
    }

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
        .into(Metric)
        .values(dataToSave)
        .execute();

      this.logger.log(
        `Bulk inserted ${dataToSave.length} metrics for Undurraga`,
      );
    } catch (error) {
      this.logger.error('Error in bulk insert', error);
    }
  }

  async getSnapshot(): Promise<SnapshotResponse> {
    this.logger.log('Fetching snapshot of latest metrics...');

    const subQuery = this.metricRepository
      .createQueryBuilder('latest')
      .select('latest.sensor_id', 'sensor_id')
      .addSelect('MAX(latest.time)', 'last_time')
      .groupBy('latest.sensor_id');

    const rows = await this.metricRepository
      .createQueryBuilder('t')
      .select(['t.sensor_id', 't.value', 't.time'])
      .innerJoin(
        '(' + subQuery.getQuery() + ')',
        'latest',
        't.sensor_id = latest.sensor_id AND t.time = latest.last_time',
      )
      .setParameters(subQuery.getParameters())
      .getRawMany();

    const formatted: SnapshotResponse = {};
    for (const row of rows) {
      formatted[row.t_sensor_id] = {
        value: Number(row.t_value),
        time: new Date(row.t_time).toISOString(),
      };
    }

    return formatted;
  }

  private async getTotalizadorData(
    sensorId: number,
    startDate: string,
    endDate: string,
  ): Promise<TotalizadorResponse[]> {
    this.logger.log(
      `Fetching totalizer data for ${sensorId} from ${startDate} to ${endDate}`,
    );

    const startDateTime = `${startDate} 00:00:00`;
    const endDateTime = `${endDate} 23:59:59`;

    const query = this.metricRepository.query(
      `
    WITH bounds AS (
      SELECT 
        DATE(time) AS day,
        MIN(time) AS first_ts,
        MAX(time) AS last_ts
      FROM undurraga_metrics
      WHERE sensor_id = $1
        AND time BETWEEN $2 AND $3
      GROUP BY DATE(time)
    )
    SELECT 
      b.day,
      m1.value AS first_value,
      m2.value AS last_value,
      (CAST(m2.value AS DECIMAL(30,6)) - CAST(m1.value AS DECIMAL(30,6))) AS totalizador_diario
    FROM bounds b
      JOIN undurraga_metrics m1 ON m1.sensor_id = $1 AND m1.time = b.first_ts
      JOIN undurraga_metrics m2 ON m2.sensor_id = $1 AND m2.time = b.last_ts
    ORDER BY b.day ASC;
    `,
      [sensorId, startDateTime, endDateTime],
    );

    const rows = await query;

    return rows.map((r: any) => ({
      value: Number(r.totalizador_diario),
      time: r.day,
    }));
  }

  async getTotalizadorPiscina(
    startDate: string,
    endDate: string,
  ): Promise<TotalizadorResponse[]> {
    if (!startDate || !endDate) {
      throw new Error(
        'Debe proporcionar las fechas de inicio (startDate) y fin (endDate) para la consulta.',
      );
    }

    return this.getTotalizadorData(5, startDate, endDate);
  }

  async getTotalizador1(
    startDate: string,
    endDate: string,
  ): Promise<TotalizadorResponse[]> {
    if (!startDate || !endDate) {
      throw new Error(
        'Debe proporcionar las fechas de inicio (startDate) y fin (endDate) para la consulta.',
      );
    }

    return this.getTotalizadorData(4, startDate, endDate);
  }

  async getTotalizador2(
    startDate: string,
    endDate: string,
  ): Promise<TotalizadorResponse[]> {
    if (!startDate || !endDate) {
      throw new Error(
        'Debe proporcionar las fechas de inicio (startDate) y fin (endDate) para la consulta.',
      );
    }

    return this.getTotalizadorData(3, startDate, endDate);
  }

  /**
   * Obtiene las últimas 100 mediciones de un sensor específico.
   * @param sensorId ID del sensor
   * @returns Arreglo con las últimas 100 métricas { value, time }
   */
  async getCaudal(
    sensorId: number,
  ): Promise<{ value: number; time: string }[]> {
    this.logger.log(`Fetching last 100 records for sensor ${sensorId}...`);

    if (!sensorId) {
      throw new Error('Debe proporcionar un ID de sensor válido.');
    }

    const rows = await this.metricRepository.query(
      `
      SELECT value, time
      FROM undurraga_metrics
      WHERE sensor_id = $1
      ORDER BY time DESC
      LIMIT 100;
      `,
      [sensorId],
    );

    return rows.map((r: any) => ({
      value: Number(r.value),
      time: new Date(r.time).toISOString(),
    }));
  }
}
