import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import * as fs from 'fs';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';
import { SENSOR_NAMES, cleanSensorName, pozoSensor } from './models/sensors';

interface DailyQueryResult {
  day: Date;
  daily_value: number;
}

@Injectable()
export class SsrCuevasService {
  private readonly logger = new Logger(SsrCuevasService.name);
  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  private normalizeDateRange(
    dto: DateRangeDto,
  ): { start: Date; end: Date } | null {
    if (!dto.start || !dto.end) return null;

    const startDate = new Date(`${dto.start}T00:00:00Z`);
    const nextDay = new Date(`${dto.end}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const endDate = new Date(`${nextDay.toISOString().slice(0, 10)}T00:00:00Z`);

    return { start: startDate, end: endDate };
  }

  private async getAlarmLevel(): Promise<number> {
    try {
      const envPath = 'C:\\AutomatizationServices\\cuevas\\.env';
      const content = await fs.promises.readFile(envPath, 'utf8');
      const match = content.match(/^NIVEL_ALERTA=(.+)$/m);
      if (match && match[1]) {
        const val = parseFloat(match[1].trim());
        if (!isNaN(val)) return val;
      }
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        this.logger.error('Error al leer NIVEL_ALERTA desde .env', error);
      }
    }
    return 2; // Valor por defecto
  }

  // Snapshot
  async getSnapshot(): Promise<{
    snapshot: MetricSnapshot;
    tiempo_vaciado_est_1: number;
    tiempo_vaciado_est_1_formatted: string;
    tiempo_vaciado_est_2: number;
    tiempo_vaciado_est_2_formatted: string;
    nivel_alerta: number;
  }> {
    const nivel_alerta = await this.getAlarmLevel();

    try {
      const results = await this.repo.query(`
    SELECT t.mt_name, t.mt_value, t.mt_time_2
    FROM ssr_cuevas t
    INNER JOIN (
      SELECT mt_name, MAX(mt_time_2) AS last_time
      FROM ssr_cuevas
      GROUP BY mt_name
    ) latest
    ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
  `);

      const snapshot: MetricSnapshot = results.reduce(
        (acc: MetricSnapshot, row: any) => {
          acc[cleanSensorName(row.mt_name)] = {
            value: Number(row.mt_value),
            time: new Date(row.mt_time_2).toISOString(),
          };
          return acc;
        },
        {},
      );

      // Funciones internas de cálculo
      const calcularTiempoVaciado = async (nombreEstanque: string) => {
        const mediciones = await this.repo.find({
          where: { mt_name: nombreEstanque },
          order: { mt_time_2: 'DESC' },
          take: 2,
        });

        if (mediciones.length < 2) {
          return { tiempo: 0, formatted: 'Llenando...' };
        }

        const [actual, anterior] = mediciones;
        const nivel_actual = Number(actual.mt_value);
        const nivel_anterior = Number(anterior.mt_value);

        const t_actual = actual.mt_time_2.getTime() / 1000;
        const t_anterior = anterior.mt_time_2.getTime() / 1000;

        if (!(nivel_actual < nivel_anterior && t_actual > t_anterior)) {
          return { tiempo: 0, formatted: 'Llenando...' };
        }

        const tasa_vaciado =
          (nivel_anterior - nivel_actual) / (t_actual - t_anterior);
        const tiempo = Math.round(nivel_actual / tasa_vaciado);

        const h = Math.floor(tiempo / 3600);
        const m = Math.floor((tiempo % 3600) / 60);
        const s = tiempo % 60;

        const formatted = `${h.toString().padStart(2, '0')} h ${m
          .toString()
          .padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`;

        return { tiempo, formatted };
      };

      const est_1 = await calcularTiempoVaciado(SENSOR_NAMES.estanque);
      const est_2 = await calcularTiempoVaciado(SENSOR_NAMES.nivel_2);

      return {
        snapshot,
        tiempo_vaciado_est_1: est_1.tiempo,
        tiempo_vaciado_est_1_formatted: est_1.formatted,
        tiempo_vaciado_est_2: est_2.tiempo,
        tiempo_vaciado_est_2_formatted: est_2.formatted,
        nivel_alerta,
      };
    } catch (error) {
      console.error('Error al obtener datos:' + error);
      return {
        snapshot: {},
        tiempo_vaciado_est_1: 0,
        tiempo_vaciado_est_1_formatted: 'Error al calcular tiempo de vaciado',
        tiempo_vaciado_est_2: 0,
        tiempo_vaciado_est_2_formatted: 'Error al calcular tiempo de vaciado',
        nivel_alerta,
      };
    }
  }

  // Daily Metrics
  private async calculateAndCacheDaily(
    metricName: string,
    start: string,
    end: string,
  ): Promise<Metric[]> {
    try {
      const cached = await this.repo.query(
        `SELECT mt_day, mt_value FROM ssr_cuevas_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
        [metricName, start, end],
      );

      const metricsMap = new Map<string, number>();
      cached.forEach((row: any) => {
        const dateStr =
          typeof row.mt_day === 'string'
            ? row.mt_day
            : row.mt_day.toISOString().split('T')[0];
        metricsMap.set(dateStr, Number(row.mt_value));
      });

      const missingDates: string[] = [];
      let currentDate = new Date(`${start}T00:00:00Z`);
      const endDate = new Date(`${end}T00:00:00Z`);
      const todayStr = new Date().toISOString().split('T')[0];

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (!metricsMap.has(dateStr) || dateStr === todayStr) {
          missingDates.push(dateStr);
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      if (missingDates.length > 0) {
        const calculated = await this.repo.query(
          `
          WITH bounds AS (
            SELECT (mt_time_2 AT TIME ZONE 'UTC')::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
            FROM ssr_cuevas
            WHERE mt_name = $1 AND (mt_time_2 AT TIME ZONE 'UTC')::DATE = ANY($2::DATE[])
            GROUP BY (mt_time_2 AT TIME ZONE 'UTC')::DATE
          )
          SELECT b.day,
            (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_cuevas s_first
            ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_cuevas s_last
            ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
          GROUP BY b.day
          `,
          [metricName, missingDates],
        );

        for (const row of calculated) {
          const dateStr =
            typeof row.day === 'string'
              ? row.day
              : row.day.toISOString().split('T')[0];
          const val = Number(row.daily_value || 0);

          await this.repo.query(
            `INSERT INTO ssr_cuevas_daily_metrics (mt_name, mt_day, mt_value) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
            [metricName, dateStr, val],
          );

          metricsMap.set(dateStr, val);
        }
      }

      const results: Metric[] = [];
      currentDate = new Date(`${start}T00:00:00Z`);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (metricsMap.has(dateStr)) {
          results.push({ time: dateStr, value: metricsMap.get(dateStr)! });
        }
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      return results;
    } catch (error) {
      this.logger.error(
        `Error en calculateAndCacheDaily para ${metricName}`,
        error,
      );
      throw error;
    }
  }

  // Totalizador
  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    if (!dto || !dto.start || !dto.end)
      throw new BadRequestException('Se requiere rango de fechas válido.');
    return this.calculateAndCacheDaily(
      SENSOR_NAMES.totalizador,
      dto.start,
      dto.end,
    );
  }

  // Horometro
  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    if (!dto || !dto.start || !dto.end)
      throw new BadRequestException('Se requiere rango de fechas válido.');
    return this.calculateAndCacheDaily(
      SENSOR_NAMES.horometro,
      dto.start,
      dto.end,
    );
  }

  // Kwh
  async getKwh(dto: DateRangeDto): Promise<Metric[]> {
    if (!dto || !dto.start || !dto.end)
      throw new BadRequestException('Se requiere rango de fechas válido.');
    return this.calculateAndCacheDaily(SENSOR_NAMES.kwh, dto.start, dto.end);
  }

  // Serie cruda de un sensor. Con start/end devuelve el rango completo (días
  // inclusivos); sin rango devuelve las últimas `limit` muestras (100 por defecto).
  private async getSeries(
    mtName: string,
    dto: DateRangeDto,
  ): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);
    const toMetric = (row: Telemetria): Metric => ({
      time: row.mt_time_2.toISOString(),
      value: Number(row.mt_value),
    });

    if (range) {
      const { start, end } = range;
      const results = await this.repo.find({
        where: {
          mt_name: mtName,
          mt_time_2: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
            start,
            end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });
      return results.map(toMetric);
    }

    const takeLimit =
      dto.limit && !isNaN(Number(dto.limit)) ? Number(dto.limit) : 100;

    const results = await this.repo.find({
      where: { mt_name: mtName },
      order: { mt_time_2: 'DESC' },
      take: takeLimit,
    });
    return results.reverse().map(toMetric);
  }

  // Series de varias variables del pozo. Sin rango: últimas 6 horas.
  private async getPozoSeries<K extends string>(
    variables: readonly K[],
    dto: DateRangeDto,
  ): Promise<Record<K, Metric[]>> {
    const range = this.normalizeDateRange(dto);

    const fetchVariable = async (variable: K): Promise<Metric[]> => {
      const mtName = pozoSensor(variable);
      const results = await this.repo.find({
        where: {
          mt_name: mtName,
          mt_time_2: range
            ? Raw((alias) => `${alias} >= :start AND ${alias} < :end`, range)
            : Raw((alias) => `${alias} >= :start`, {
                start: new Date(Date.now() - 6 * 60 * 60 * 1000),
              }),
        },
        order: { mt_time_2: 'ASC' },
      });
      return results.map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    };

    const series = await Promise.all(variables.map(fetchVariable));
    return Object.fromEntries(
      variables.map((variable, i) => [variable, series[i]]),
    ) as Record<K, Metric[]>;
  }

  // Nivel estanque 1
  getNivel(dto: DateRangeDto): Promise<Metric[]> {
    return this.getSeries(SENSOR_NAMES.estanque, dto);
  }

  // Nivel estanque 2 (ESTANQUE_20M3--slave.AI12 -> nivel_2)
  getNivel2(dto: DateRangeDto): Promise<Metric[]> {
    return this.getSeries(SENSOR_NAMES.nivel_2, dto);
  }

  // Voltaje del panel solar del estanque 2 (ESTANQUE_20M3--slave.AI32 -> voltaje_2)
  getVoltaje2(dto: DateRangeDto): Promise<Metric[]> {
    return this.getSeries(SENSOR_NAMES.voltaje_2, dto);
  }

  // Freático
  getFreatico(dto: DateRangeDto): Promise<Metric[]> {
    return this.getSeries(SENSOR_NAMES.freatico, dto);
  }

  // Caudal
  getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    return this.getSeries(SENSOR_NAMES.caudal, dto);
  }

  // Corriente (I1, I2, I3)
  getCorriente(dto: DateRangeDto) {
    return this.getPozoSeries(['I1', 'I2', 'I3'] as const, dto);
  }

  // Voltaje (L1, L2, L3)
  getVoltaje(dto: DateRangeDto) {
    return this.getPozoSeries(['L1', 'L2', 'L3'] as const, dto);
  }
}
