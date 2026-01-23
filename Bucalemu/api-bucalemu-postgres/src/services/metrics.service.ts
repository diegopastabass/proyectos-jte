import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { DateRangeDto } from '../models/dto/date-range.dto';
import { Metric } from '../models/metric.entity';

export class Total {
  time: string;
  value: number;
}

interface DailyQueryResult {
  day: Date;
  daily_value: number;
}

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);

  // Buffer para acumular mediciones
  private metricsBuffer: CreateMetricDto[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(
    @InjectRepository(Metric)
    private readonly metricRepository: Repository<Metric>,
  ) {}

  // Iniciar el cron de vaciado al arrancar
  onModuleInit() {
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 30000); // Guardar cada 30 segundos
  }

  onModuleDestroy() {
    clearInterval(this.flushInterval);
    this.flushMetrics(); // Guardado final
  }

  // Create Metric (Modificado para usar Buffer)
  async createMetric(
    dto: CreateMetricDto,
  ): Promise<{ success: boolean; message: string }> {
    this.metricsBuffer.push(dto);

    // Si el buffer se llena mucho, forzar guardado
    if (this.metricsBuffer.length >= 100) {
      await this.flushMetrics();
    }

    return { success: true, message: 'Metric buffered' };
  }

  // Función privada para guardar en lote
  private async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    const dataToSave = [...this.metricsBuffer];
    this.metricsBuffer = []; // Limpiar buffer inmediatamente

    try {
      // insert es mucho más rápido que save para arrays grandes
      await this.metricRepository
        .createQueryBuilder()
        .insert()
        .into('ssr_bucalemu')
        .values(dataToSave)
        .execute();

      this.logger.log(`Bulk inserted ${dataToSave.length} metrics`);
    } catch (error) {
      this.logger.error('Error in bulk insert', error);
      // Opcional: Reintentar o guardar en archivo de error
    }
  }

  // Find Latest Metrics
  async findLatestMetrics(limit: number): Promise<Metric[]> {
    return this.metricRepository.find({
      order: { mt_time_2: 'DESC' },
      take: limit,
    });
  }

  // Find Latest Metric By Name
  async findLatestMetricByName(name: string): Promise<Metric | null> {
    return this.metricRepository.findOne({
      where: { mt_name: name },
      order: { mt_time_2: 'DESC' },
    });
  }

  // Find Latest For Each Name (Remapeado y corrección valor Casuto)
  async findLatestForEachName(): Promise<
    Record<string, { value: number; time: Date }>
  > {
    const metrics = await this.metricRepository
      .createQueryBuilder('metric')
      .distinctOn(['metric.mt_name'])
      .orderBy('metric.mt_name')
      .addOrderBy('metric.mt_time_2', 'DESC')
      .getMany();

    const result: Record<string, { value: number; time: Date }> = {};
    metrics.forEach((metric) => {
      let finalName = metric.mt_name;
      let finalValue = Number(metric.mt_value);

      if (metric.mt_name === 'CASUTO--slave.AI12') {
        finalName = 'ssr_casuto_nivel';
        finalValue = finalValue / 100;
      } else if (metric.mt_name === 'CASUTO--slave.AI32') {
        finalName = 'ssr_casuto_bateria';
      }

      result[finalName] = {
        value: finalValue,
        time: metric.mt_time_2,
      };
    });

    return result;
  }

  // Find Last Update Time
  async findLastUpdateTime(): Promise<Date | null> {
    const result = await this.metricRepository
      .createQueryBuilder('metric')
      .select('MAX(metric.mt_time_2)', 'lastUpdateTime')
      .getRawOne<{ lastUpdateTime: Date }>();

    return result?.lastUpdateTime ?? null;
  }

  // Find All Measurements (Incluye Casuto y corrección valor)
  async findAllMeasurements(): Promise<
    Record<string, { mt_value: number; mt_time_2: Date }[]>
  > {
    const rawQuery = `
      SELECT subquery.*
      FROM (
        SELECT
          *,
          ROW_NUMBER() OVER (PARTITION BY "mt_name" ORDER BY "mt_time_2" DESC) as rn
        FROM "ssr_bucalemu"
      ) as subquery
      WHERE subquery.rn <= 100
      AND (subquery."mt_name" LIKE '%nivel' OR subquery."mt_name" = 'CASUTO--slave.AI12')
      ORDER BY subquery."mt_name", subquery.rn DESC;
    `;

    type MeasurementRow = {
      mt_name: string;
      mt_value: number | string;
      mt_time_2: string | Date;
      [key: string]: unknown;
    };

    const rows = (await this.metricRepository.query(
      rawQuery,
    )) as MeasurementRow[];

    const grouped: Record<string, { mt_value: number; mt_time_2: Date }[]> = {};
    rows.forEach((row) => {
      let name = row.mt_name;
      let value = Number(row.mt_value);

      if (name === 'CASUTO--slave.AI12') {
        name = 'ssr_casuto_nivel';
        value = value / 100;
      }

      if (!grouped[name]) {
        grouped[name] = [];
      }
      grouped[name].push({
        mt_value: value,
        mt_time_2: new Date(row.mt_time_2),
      });
    });

    return grouped;
  }

  // Estimate Emptying Times (Incluye Casuto y corrección valor)
  async estimateEmptyingTimes(): Promise<{ [key: string]: string }> {
    try {
      const rawQuery = `
      SELECT *
      FROM (
        SELECT 
          "mt_name",
          "mt_value",
          "mt_time_2",
          ROW_NUMBER() OVER (PARTITION BY "mt_name" ORDER BY "mt_time_2" DESC) AS rn
        FROM "ssr_bucalemu"
        WHERE "mt_name" LIKE '%nivel' OR "mt_name" = 'CASUTO--slave.AI12'
      ) t
      WHERE t.rn <= 2
      ORDER BY t."mt_name", t.rn;
    `;

      type MeasurementRow = {
        mt_name: string;
        mt_value: number | string;
        mt_time_2: string | Date;
        rn: number;
      };

      const rows = (await this.metricRepository.query(
        rawQuery,
      )) as MeasurementRow[];

      const grouped: Record<string, { value: number; time: string }[]> = {};
      rows.forEach((row) => {
        let value = Number(row.mt_value);
        if (row.mt_name === 'CASUTO--slave.AI12') {
          value = value / 100;
        }

        if (!grouped[row.mt_name]) grouped[row.mt_name] = [];
        grouped[row.mt_name].push({
          value: value,
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

        let key: string;
        if (name === 'CASUTO--slave.AI12') {
          key = 't_vaciado_casuto_nivel';
        } else {
          key = `t_vaciado_${name.replace(/^ssr_/, '')}`;
        }

        result[key] = isNaN(segundos)
          ? 'NaN'
          : this.formatSecondsToDuration(Math.round(segundos));
      }

      return result;
    } catch (error) {
      this.logger.error('Error estimating emptying times', error);
      throw new InternalServerErrorException('Error estimating emptying times');
    }
  }

  // Helper Estimate Calculation
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

  // Get Totalizador
  async getTotalizador(dto: DateRangeDto): Promise<Total[]> {
    const { start, end } = dto;
    if (!start || !end) throw new Error('Se requiere rango de fechas válido.');

    const isoStart = start.toISOString().split('T')[0];
    const isoEnd = end.toISOString().split('T')[0];

    const queryStart = `${isoStart} 00:00:00`;
    const queryEnd = `${isoEnd} 23:59:59`;

    const results: DailyQueryResult[] = await this.metricRepository.query(
      `
        WITH bounds AS (
          SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_bucalemu
          WHERE mt_name = 'ssr_nilahue_totalizador'
          AND mt_time_2 BETWEEN $1 AND $2
          GROUP BY mt_time_2::DATE
        )
        SELECT b.day,
          (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_bucalemu s_first
          ON s_first.mt_name = 'ssr_nilahue_totalizador' AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_bucalemu s_last
          ON s_last.mt_name = 'ssr_nilahue_totalizador' AND s_last.mt_time_2 = b.last_ts
        GROUP BY b.day
        ORDER BY b.day ASC
      `,
      [queryStart, queryEnd],
    );

    return results.map((row) => ({
      time:
        typeof row.day === 'string'
          ? row.day
          : row.day.toISOString().split('T')[0],
      value: Number(row.daily_value),
    }));
  }

  // Format Date Helper
  private formatDate(date: Date): string {
    const d = new Date(date);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getDate())}-${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Get Caudal
  async getCaudal(
    dto: DateRangeDto,
  ): Promise<{ time: string; value: number }[]> {
    const { start, end } = dto || {};
    let results;

    if (!start || !end) {
      results = await this.metricRepository.find({
        where: { mt_name: 'ssr_nilahue_caudal' },
        order: { mt_time_2: 'DESC' },
        take: 100,
      });
      results.reverse();
    } else {
      results = await this.metricRepository.find({
        where: {
          mt_name: 'ssr_nilahue_caudal',
          mt_time_2: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
            start,
            end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });
    }

    return results.map((row) => ({
      time: this.formatDate(row.mt_time_2),
      value: Number(row.mt_value),
    }));
  }

  // Format Seconds Helper
  private formatSecondsToDuration(seconds: number): string {
    if (seconds < 0) return 'NaN';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (secs > 0 || result === '') result += `${secs}s`;

    return result.trim();
  }
}
