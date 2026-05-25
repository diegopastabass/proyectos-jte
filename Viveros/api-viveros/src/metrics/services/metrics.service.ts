import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { Metric } from '../models/metric.entity';

interface ViverosRow {
  id: number;
  sensor_name: string;
  value: string | number;
  time: string | Date;
}

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
    }, 120000);
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
        .into('viveros_tambo')
        .values(dataToSave)
        .execute();

      this.logger.log(`Bulk inserted ${dataToSave.length} metrics`);
    } catch (error) {
      this.logger.error('Error in bulk insert', error);
    }
  }

  /**
   * Calcula el Déficit de Presión de Vapor (VPD) en kPa.
   * @param tempC Temperatura en grados Celsius
   * @param humidity Humedad relativa en porcentaje (0-100)
   * @returns VPD en kPa, redondeado a 2 decimales
   */
  static calculateVPD(tempC: number, humidity: number): number {
    const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
    const avp = svp * (humidity / 100);
    const vpd = svp - avp;
    return Math.round(vpd * 100) / 100;
  }

  async findLatestForEachSensor(): Promise<
    Record<string, { value: number; time: Date }> & {
      vpd_calor?: number;
      vpd_frio?: number;
      vpd_ambiente?: number;
    }
  > {
    try {
      const subQuery = this.metricRepository
        .createQueryBuilder('m1')
        .select('m1.sensor_id', 'sensor_id')
        .addSelect('MAX(m1.time)', 'max_time')
        .groupBy('m1.sensor_id');

      const query = this.metricRepository
        .createQueryBuilder('m')
        .select([
          'm.sensor_id AS sensor_id',
          'm.value AS value',
          'm.time AS time',
        ])
        .innerJoin(
          `(${subQuery.getQuery()})`,
          'sub',
          'm.sensor_id = sub.sensor_id AND m.time = sub.max_time',
        )
        .setParameters(subQuery.getParameters());

      const results = await query.getRawMany<{
        sensor_id: string;
        value: number;
        time: Date;
      }>();

      const mappedResults = results.reduce(
        (acc, row) => {
          acc[row.sensor_id] = {
            value: row.value,
            time: row.time,
          };
          return acc;
        },
        {} as Record<string, { value: number; time: Date }>,
      );

      // Calcular VPD para cada zona usando temperatura + humedad del mismo sensor
      // Sensor 5: T Calor, Sensor 3: HR Calor
      // Sensor 6: T Frío,  Sensor 4: HR Frío
      // Sensor 7: T Ambiente, Sensor 8: HR Ambiente
      if (mappedResults['5'] && mappedResults['3']) {
        (mappedResults as any).vpd_calor = MetricsService.calculateVPD(
          Number(mappedResults['5'].value),
          Number(mappedResults['3'].value),
        );
      }
      if (mappedResults['6'] && mappedResults['4']) {
        (mappedResults as any).vpd_frio = MetricsService.calculateVPD(
          Number(mappedResults['6'].value),
          Number(mappedResults['4'].value),
        );
      }
      if (mappedResults['7'] && mappedResults['8']) {
        (mappedResults as any).vpd_ambiente = MetricsService.calculateVPD(
          Number(mappedResults['7'].value),
          Number(mappedResults['8'].value),
        );
      }

      this.logger.log(
        `Retrieved latest metrics for each sensor, count: ${results.length}`,
      );

      return mappedResults;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error('Error retrieving latest metrics', error.stack);
      throw new InternalServerErrorException('Error retrieving latest metrics');
    }
  }

  async findMetricsBySensorsAndDateRange(
    startDate: string,
    endDate: string,
  ): Promise<Record<string, { value: number; time: Date }[]>> {
    try {
      // Normalizar fechas
      const startDateTime = new Date(`${startDate}T00:00:00`);
      const endDateTime = new Date(`${endDate}T23:59:59`);

      const results = await this.metricRepository
        .createQueryBuilder('m')
        .where('m.sensor_id IN (:...sensorIds)', { sensorIds: [3, 4, 5, 6] })
        .andWhere('m.time BETWEEN :startDate AND :endDate', {
          startDate: startDateTime,
          endDate: endDateTime,
        })
        .orderBy('m.time', 'ASC')
        .getMany();

      // Agrupar resultados por sensor_id
      const grouped = results.reduce(
        (acc, row) => {
          if (!acc[row.sensor_id]) {
            acc[row.sensor_id] = [];
          }
          acc[row.sensor_id].push({
            value: row.value,
            time: row.time,
          });
          return acc;
        },
        {} as Record<string, { value: number; time: Date }[]>,
      );

      this.logger.log(
        `Retrieved metrics grouped by sensor between ${startDateTime.toISOString()} and ${endDateTime.toISOString()}`,
      );

      return grouped;
    } catch (error) {
      this.logger.error(
        'Error retrieving metrics by sensors and date range',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error.stack,
      );
      throw new InternalServerErrorException(
        'Error retrieving metrics by sensors and date range',
      );
    }
  }

  async findChartData(): Promise<
    Record<string, { value: number; time: Date }[]>
  > {
    try {
      // IDs de los sensores que nos interesan
      const sensorIds = [3, 4, 5, 6];

      // Creamos un arreglo para guardar los resultados
      const grouped: Record<string, { value: number; time: Date }[]> = {};
      sensorIds.forEach((id) => (grouped[id.toString()] = []));

      // Consultamos las últimas 100 mediciones por sensor
      for (const sensorId of sensorIds) {
        const results = await this.metricRepository
          .createQueryBuilder('m')
          .where('m.sensor_id = :sensorId', { sensorId })
          .orderBy('m.time', 'DESC')
          .limit(100)
          .getMany();

        // Ordenamos ascendente para que los datos queden cronológicos
        grouped[sensorId.toString()] = results
          .map((r) => ({ value: r.value, time: r.time }))
          .sort((a, b) => a.time.getTime() - b.time.getTime());
      }

      this.logger.log(
        `Retrieved last 100 metrics for sensors ${sensorIds.join(', ')}`,
      );

      return grouped;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error('Error retrieving chart data', error.stack);
      throw new InternalServerErrorException('Error retrieving chart data');
    }
  }

  async getViverosDataForExcel(
    fechaInicio: string,
    fechaFin: string,
  ): Promise<{ id: number; sensor_name: string; value: number; time: Date }[]> {
    try {
      const startDateTime = new Date(`${fechaInicio}T00:00:00`);
      const endDateTime = new Date(`${fechaFin}T23:59:59`);

      const results: ViverosRow[] = await this.metricRepository.query(
        `
          SELECT id, sensor_name, value, time
          FROM viveros_tambo_view
          WHERE time BETWEEN $1 AND $2
          ORDER BY time DESC
        `,
        [startDateTime, endDateTime],
      );

      this.logger.log(
        `Retrieved viveros data for Excel between ${startDateTime.toISOString()} and ${endDateTime.toISOString()}`,
      );

      return results.map((row) => ({
        id: row.id,
        sensor_name: row.sensor_name,
        value: Number(row.value),
        time: new Date(row.time),
      }));
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error('Error retrieving viveros data for Excel', error.stack);
      throw new InternalServerErrorException(
        'Error retrieving viveros data for Excel',
      );
    }
  }

  async getMinMax(
    date: string,
  ): Promise<Record<string, { min: number; max: number }>> {
    try {
      const startDateTime = new Date(`${date}T00:00:00`);
      const endDateTime = new Date(`${date}T23:59:59`);

      const sensorIds = [3, 4, 5, 6];

      const results = await this.metricRepository
        .createQueryBuilder('m')
        .select('m.sensor_id', 'sensor_id')
        .addSelect('MIN(m.value)', 'min')
        .addSelect('MAX(m.value)', 'max')
        .where('m.sensor_id IN (:...sensorIds)', { sensorIds })
        .andWhere('m.time BETWEEN :startDate AND :endDate', {
          startDate: startDateTime,
          endDate: endDateTime,
        })
        .groupBy('m.sensor_id')
        .getRawMany<{ sensor_id: string; min: number; max: number }>();

      const mapped = results.reduce(
        (acc, row) => {
          acc[row.sensor_id] = {
            min: Number(row.min),
            max: Number(row.max),
          };
          return acc;
        },
        {} as Record<string, { min: number; max: number }>,
      );

      this.logger.log(
        `Retrieved min/max metrics for sensors ${sensorIds.join(', ')} on ${date}`,
      );

      return mapped;
    } catch (error) {
      this.logger.error('Error retrieving min/max metrics', error.stack);
      throw new InternalServerErrorException(
        'Error retrieving min/max metrics',
      );
    }
  }
}
