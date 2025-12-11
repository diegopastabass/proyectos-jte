import {
  Injectable,
  InternalServerErrorException,
  Logger,
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
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    @InjectRepository(Metric)
    private readonly metricRepository: Repository<Metric>,
  ) {}

  async createMetric(
    dto: CreateMetricDto,
  ): Promise<{ success: boolean; insertedId: number }> {
    try {
      dto.value = Number(dto.value);

      const metric = this.metricRepository.create(dto);
      const result = await this.metricRepository.save(metric);
      this.logger.log(`Inserted metric with id ${result.id}`);
      return { success: true, insertedId: result.id };
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.logger.error('Error inserting metric', error.stack);
      throw new InternalServerErrorException('Error inserting metric');
    }
  }

  async findLatestForEachSensor(): Promise<
    Record<string, { value: number; time: Date }>
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
