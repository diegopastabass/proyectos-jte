import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { Metric } from '../models/metric.entity';
import { calcularVpd } from '../lib/analisis';
import { localDeInstante, sumarDias, textoLocal } from '../lib/fechas';
import { valorSql } from '../viveros.config';
import { ultimasPorSensor } from '../lib/consultas';

/** Sensores de temperatura y humedad (los 1 y 2 son el estado de los equipos). */
const SENSORES_TH = ['3', '4', '5', '6', '7', '8'];
const SENSORES_TODOS = ['1', '2', ...SENSORES_TH];

interface ViverosRow {
  id: number;
  sensor_name: string;
  value: string | number;
  time: string | Date;
}

interface MetricaEnBuffer extends CreateMetricDto {
  /** Hora de llegada en hora Chile, para que no quede la hora del volcado. */
  time: string;
}

type Punto = { value: number; time: Date };

/**
 * Las consultas comparan la columna `time` (hora Chile sin zona) con texto en esa
 * misma hora y devuelven `time AT TIME ZONE 'America/Santiago'`: el resultado no
 * depende de la zona horaria del proceso Node.
 */
@Injectable()
export class MetricsService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MetricsService.name);

  private metricsBuffer: MetricaEnBuffer[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(Metric)
    private readonly metricRepository: Repository<Metric>,
  ) {}

  onModuleInit() {
    this.flushInterval = setInterval(() => {
      void this.flushMetrics();
    }, 120000);
  }

  async onApplicationShutdown() {
    clearInterval(this.flushInterval);
    await this.flushMetrics();
  }

  /** Ingesta por `POST /`: el contrato (cuerpo y respuesta) no cambia. */
  async createMetric(
    dto: CreateMetricDto,
  ): Promise<{ success: boolean; message: string }> {
    this.metricsBuffer.push({ ...dto, time: localDeInstante(Date.now()) });

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
      // Parámetros sin tipo: Postgres los convierte a los tipos reales de la tabla
      // (sensor_id es numérico en producción aunque la entidad diga varchar).
      const filas = dataToSave.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`);
      await this.metricRepository.query(
        `INSERT INTO viveros_tambo (sensor_id, value, time) VALUES ${filas.join(', ')}`,
        dataToSave.flatMap((m) => [m.sensor_id, m.value, m.time]),
      );

      this.logger.log(`Bulk inserted ${dataToSave.length} metrics`);
    } catch (error) {
      this.logger.error('Error in bulk insert', error);
    }
  }

  /** @deprecated Usar `calcularVpd` de `lib/analisis`. Se mantiene por compatibilidad. */
  static calculateVPD(tempC: number, humidity: number): number {
    return calcularVpd(tempC, humidity) ?? 0;
  }

  async findLatestForEachSensor(): Promise<
    Record<string, { value: number; time: Date }> & {
      vpd_calor?: number;
      vpd_frio?: number;
      vpd_ambiente?: number;
    }
  > {
    try {
      const results = await ultimasPorSensor(this.metricRepository, SENSORES_TODOS);

      const mappedResults: Record<string, { value: number; time: Date }> = {};
      for (const row of results) {
        mappedResults[row.sensor_id] = {
          value: Number(row.value),
          time: row.time,
        };
      }

      // VPD por zona con la temperatura y la humedad de la misma zona
      // (5 y 3: calor; 6 y 4: frío; 7 y 8: exterior/ambiente).
      const vpd = (t: string, hr: string) =>
        mappedResults[t] && mappedResults[hr]
          ? (calcularVpd(mappedResults[t].value, mappedResults[hr].value) ?? undefined)
          : undefined;

      return Object.assign(mappedResults, {
        vpd_calor: vpd('5', '3'),
        vpd_frio: vpd('6', '4'),
        vpd_ambiente: vpd('7', '8'),
      });
    } catch (error) {
      this.logger.error('Error retrieving latest metrics', (error as Error).stack);
      throw new InternalServerErrorException('Error retrieving latest metrics');
    }
  }

  private agrupar(filas: { sensor_id: string; value: number; time: Date }[]) {
    const grouped: Record<string, Punto[]> = {};
    for (const row of filas) {
      (grouped[String(row.sensor_id)] ??= []).push({
        value: Number(row.value),
        time: row.time,
      });
    }
    return grouped;
  }

  async findMetricsBySensorsAndDateRange(
    startDate: string,
    endDate: string,
  ): Promise<Record<string, Punto[]>> {
    try {
      const filas = await this.metricRepository.query(
        `SELECT sensor_id, (${valorSql()})::float8 AS value,
                time AT TIME ZONE 'America/Santiago' AS time
           FROM viveros_tambo
          WHERE sensor_id = ANY($1) AND time >= $2 AND time < $3
          ORDER BY time ASC`,
        [SENSORES_TH, textoLocal(startDate), textoLocal(sumarDias(endDate, 1))],
      );
      return this.agrupar(filas);
    } catch (error) {
      this.logger.error(
        'Error retrieving metrics by sensors and date range',
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Error retrieving metrics by sensors and date range',
      );
    }
  }

  /** Últimas 100 lecturas por sensor (ruta antigua del dashboard). */
  async findChartData(): Promise<Record<string, Punto[]>> {
    try {
      const filas = await ultimasPorSensor(this.metricRepository, SENSORES_TH, 100);
      const grouped = this.agrupar(filas);
      for (const id of SENSORES_TH) grouped[id] ??= [];
      return grouped;
    } catch (error) {
      this.logger.error('Error retrieving chart data', (error as Error).stack);
      throw new InternalServerErrorException('Error retrieving chart data');
    }
  }

  async getViverosDataForExcel(
    fechaInicio: string,
    fechaFin: string,
  ): Promise<{ id: number; sensor_name: string; value: number; time: Date }[]> {
    try {
      const results: ViverosRow[] = await this.metricRepository.query(
        `
          SELECT id, sensor_name,
                 CASE WHEN sensor_name IN ('Temperatura Calor', 'Temperatura Frio') AND value > 6000
                      THEN value - 6553.6 ELSE value END AS value,
                 time AT TIME ZONE 'America/Santiago' AS time
          FROM viveros_tambo_view
          WHERE time >= $1 AND time < $2
          ORDER BY time DESC
        `,
        [textoLocal(fechaInicio), textoLocal(sumarDias(fechaFin, 1))],
      );

      return results.map((row) => ({
        id: row.id,
        sensor_name: row.sensor_name,
        value: Number(row.value),
        time: new Date(row.time),
      }));
    } catch (error) {
      this.logger.error('Error retrieving viveros data for Excel', (error as Error).stack);
      throw new InternalServerErrorException(
        'Error retrieving viveros data for Excel',
      );
    }
  }

  /** Mínimo y máximo del día (hora Chile) por sensor. Lo usa el monitor de alarmas. */
  async getMinMax(
    date: string,
  ): Promise<Record<string, { min: number; max: number }>> {
    try {
      const results: { sensor_id: string; min: number; max: number }[] =
        await this.metricRepository.query(
          `SELECT sensor_id, MIN(${valorSql()})::float8 AS min, MAX(${valorSql()})::float8 AS max
             FROM viveros_tambo
            WHERE sensor_id = ANY($1) AND time >= $2 AND time < $3
            GROUP BY sensor_id`,
          [SENSORES_TH, textoLocal(date), textoLocal(sumarDias(date, 1))],
        );

      const mapped: Record<string, { min: number; max: number }> = {};
      for (const row of results) {
        mapped[String(row.sensor_id)] = { min: Number(row.min), max: Number(row.max) };
      }
      return mapped;
    } catch (error) {
      this.logger.error('Error retrieving min/max metrics', (error as Error).stack);
      throw new InternalServerErrorException(
        'Error retrieving min/max metrics',
      );
    }
  }
}
