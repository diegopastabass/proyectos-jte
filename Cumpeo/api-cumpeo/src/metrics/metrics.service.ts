import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

@Injectable()
export class SsrCumpeoService {
  private readonly logger = new Logger(SsrCumpeoService.name);

  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  /**
   * Formatea un Date como string ISO usando la hora local del servidor,
   * sin conversión a UTC. La DB almacena timestamps en hora Chile
   * y .toISOString() los convierte erróneamente a UTC (+4h).
   */
  private toLocalISOString(date: Date): string {
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
      `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
      `.${pad(date.getMilliseconds(), 3)}`
    );
  }

  /**
   * Convierte el DTO a strings de fecha listos para usar en consultas SQL.
   * Se pasan como strings (no como objetos Date) para evitar que JS/TypeORM
   * los convierta a UTC. PostgreSQL los interpreta en su timezone configurada
   * (America/Santiago).
   */
  private normalizeDateRange(
    dto: DateRangeDto,
  ): { start: string; end: string } | null {
    try {
      if (!dto.start || !dto.end) return null;
      const pad = (n: number) => String(n).padStart(2, '0');
      // Calcular el día siguiente para límite exclusivo (>= start AND < end)
      const [year, month, day] = dto.end.split('-').map(Number);
      const nextDay = new Date(year, month - 1, day + 1);
      const nextDayStr = `${nextDay.getFullYear()}-${pad(nextDay.getMonth() + 1)}-${pad(nextDay.getDate())}`;
      return {
        start: `${dto.start} 00:00:00`,
        end: `${nextDayStr} 00:00:00`,
      };
    } catch (error) {
      this.logger.error(
        `Error en normalizeDateRange con dto: ${JSON.stringify(dto)} - ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async getSnapshot() {
    try {
      this.logger.log('Iniciando getSnapshot...');
      const results = await this.repo.query(`
        SELECT t.mt_name, t.mt_value, t.mt_time_2
        FROM ssr_cumpeo t
        INNER JOIN (
          SELECT mt_name, MAX(mt_time_2) AS last_time
          FROM ssr_cumpeo
          GROUP BY mt_name
        ) latest
        ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
      `);

      // Prefijos para clasificar las métricas
      const POZO1_PREFIX = 'SSR_CUMPEO_6--slave.';
      const POZO2_CAUDAL = 'SSR_CUMPEO--slave.caudal_pozos';
      const ESTANQUE_NAME = 'SSR_CUMPEO--slave.estanque';

      const pozo1: MetricSnapshot = {};
      const pozo2: MetricSnapshot = {};
      const estanqueSnapshot: MetricSnapshot = {};

      for (const row of results) {
        const metric: Metric = {
          value: Number(row.mt_value),
          time: this.toLocalISOString(new Date(row.mt_time_2)),
        };

        if (row.mt_name.startsWith(POZO1_PREFIX)) {
          // Pozo 1: todo lo que tenga _6
          const cleanName = row.mt_name.replace(POZO1_PREFIX, '');
          pozo1[cleanName] = metric;
        } else if (row.mt_name === POZO2_CAUDAL) {
          // Pozo 2: solo caudal_pozos
          pozo2['caudal_pozos'] = metric;
        } else if (row.mt_name === ESTANQUE_NAME) {
          // Estanque
          estanqueSnapshot['estanque'] = metric;
        }
      }

      const calcularTiempoVaciado = async (nombreEstanque: string) => {
        try {
          const mediciones: { mt_value: string; mt_time_2: string }[] =
            await this.repo.query(
              `SELECT mt_value, mt_time_2 FROM ssr_cumpeo WHERE mt_name = $1 ORDER BY mt_time_2 DESC LIMIT 2`,
              [nombreEstanque],
            );
          if (mediciones.length < 2)
            return { tiempo: 0, formatted: 'Llenando...' };
          const [actual, anterior] = mediciones;
          const [nivel_actual, nivel_anterior] = [
            Number(actual.mt_value),
            Number(anterior.mt_value),
          ];
          const [t_actual, t_anterior] = [
            new Date(actual.mt_time_2).getTime() / 1000,
            new Date(anterior.mt_time_2).getTime() / 1000,
          ];
          if (!(nivel_actual < nivel_anterior && t_actual > t_anterior))
            return { tiempo: 0, formatted: 'Llenando...' };
          const tasa_vaciado =
            (nivel_anterior - nivel_actual) / (t_actual - t_anterior);
          const tiempo = Math.round(nivel_actual / tasa_vaciado);
          const h = Math.floor(tiempo / 3600);
          const m = Math.floor((tiempo % 3600) / 60);
          const s = tiempo % 60;
          return {
            tiempo,
            formatted: `${h.toString().padStart(2, '0')} h ${m.toString().padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`,
          };
        } catch (err) {
          this.logger.error(
            `Error en calcularTiempoVaciado para ${nombreEstanque}: ${err instanceof Error ? err.message : err}`,
            err instanceof Error ? err.stack : undefined,
          );
          return { tiempo: 0, formatted: 'Llenando...' };
        }
      };

      const vaciado = await calcularTiempoVaciado('SSR_CUMPEO--slave.estanque');
      return {
        pozo1,
        pozo2,
        estanque: estanqueSnapshot,
        tiempo_vaciado: vaciado.tiempo,
        tiempo_vaciado_formatted: vaciado.formatted,
      };
    } catch (error) {
      this.logger.error(
        `Error en getSnapshot: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async calculateAndCacheDaily(
    metricName: string,
    start: string,
    end: string,
  ): Promise<Metric[]> {
    try {
      this.logger.log(
        `Iniciando calculateAndCacheDaily para ${metricName} entre ${start} y ${end}`,
      );
      const cached = await this.repo.query(
        `SELECT mt_day, mt_value FROM ssr_cumpeo_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
        [metricName, start, end],
      );

      const metricsMap = new Map<string, number>();
      const pad = (n: number) => String(n).padStart(2, '0');
      const toDateStr = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      cached.forEach((row: any) =>
        metricsMap.set(
          typeof row.mt_day === 'string'
            ? row.mt_day.split('T')[0]
            : toDateStr(row.mt_day),
          Number(row.mt_value),
        ),
      );

      const missingDates: string[] = [];
      const [sy, sm, sd] = start.split('-').map(Number);
      let currentDate = new Date(sy, sm - 1, sd);
      const [ey, em, ed] = end.split('-').map(Number);
      const endDate = new Date(ey, em - 1, ed);
      const todayStr = toDateStr(new Date());

      while (currentDate <= endDate) {
        const dateStr = toDateStr(currentDate);
        if (!metricsMap.has(dateStr) || dateStr === todayStr)
          missingDates.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (missingDates.length > 0) {
        const calculated = await this.repo.query(
          `
          WITH bounds AS (
            SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
            FROM ssr_cumpeo
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day, (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_cumpeo s_first ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_cumpeo s_last ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
          GROUP BY b.day
        `,
          [metricName, missingDates],
        );

        for (const row of calculated) {
          const dateStr =
            typeof row.day === 'string'
              ? row.day.split('T')[0]
              : toDateStr(row.day);
          await this.repo.query(
            `INSERT INTO ssr_cumpeo_daily_metrics (mt_name, mt_day, mt_value) VALUES ($1, $2, $3) ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
            [metricName, dateStr, Number(row.daily_value || 0)],
          );
          metricsMap.set(dateStr, Number(row.daily_value || 0));
        }
      }

      const results: Metric[] = [];
      currentDate = new Date(sy, sm - 1, sd);
      while (currentDate <= endDate) {
        const dateStr = toDateStr(currentDate);
        if (metricsMap.has(dateStr))
          results.push({ time: dateStr, value: metricsMap.get(dateStr)! });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return results;
    } catch (error) {
      this.logger.error(
        `Error en calculateAndCacheDaily para ${metricName} [start=${start}, end=${end}]: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end)
        throw new Error('Rango inválido: start y end son requeridos');
      return await this.calculateAndCacheDaily(
        'SSR_CUMPEO_6--slave.totalizador',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error(
        `Error en getTotalizador con dto: ${JSON.stringify(dto)} - ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end)
        throw new Error('Rango inválido: start y end son requeridos');
      return await this.calculateAndCacheDaily(
        'SSR_CUMPEO_6--slave.horometro',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error(
        `Error en getTotalizador con dto: ${JSON.stringify(dto)} - ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (range) {
        const results = await this.repo.find({
          where: {
            mt_name: 'SSR_CUMPEO--slave.estanque',
            mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
              start: range.start,
              end: range.end,
            }),
          },
          order: { mt_time_2: 'ASC' },
        });
        return results.map((r) => ({
          time: this.toLocalISOString(r.mt_time_2),
          value: Number(r.mt_value),
        }));
      }
      const results = await this.repo.find({
        where: { mt_name: 'SSR_CUMPEO--slave.estanque' },
        order: { mt_time_2: 'DESC' },
        take: dto.limit ? Number(dto.limit) : 100,
      });
      return results.reverse().map((r) => ({
        time: this.toLocalISOString(r.mt_time_2),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error(
        `Error en getNivel con dto: ${JSON.stringify(dto)} - ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getNivel2(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (range) {
        const results = await this.repo.find({
          where: {
            mt_name: 'SSR_CUMPEO--slave.estanque_2',
            mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
              start: range.start,
              end: range.end,
            }),
          },
          order: { mt_time_2: 'ASC' },
        });
        return results.map((r) => ({
          time: this.toLocalISOString(r.mt_time_2),
          value: Number(r.mt_value),
        }));
      }
      const results = await this.repo.find({
        where: { mt_name: 'SSR_CUMPEO--slave.estanque_2' },
        order: { mt_time_2: 'DESC' },
        take: dto.limit ? Number(dto.limit) : 100,
      });
      return results.reverse().map((r) => ({
        time: this.toLocalISOString(r.mt_time_2),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error(
        `Error en getNivel2 con dto: ${JSON.stringify(dto)} - ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getCaudal1(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: 'SSR_CUMPEO_6--slave.caudal' },
          order: { mt_time_2: 'DESC' },
          take: 100,
        });
        return results.reverse().map((r) => ({
          time: this.toLocalISOString(r.mt_time_2),
          value: Number(r.mt_value),
        }));
      }
      const results = await this.repo.find({
        where: {
          mt_name: 'SSR_CUMPEO_6--slave.caudal',
          mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
            start: range.start,
            end: range.end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });
      return results.map((r) => ({
        time: this.toLocalISOString(r.mt_time_2),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error(
        `Error en getCaudal1 con dto: ${JSON.stringify(dto)} - ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getCaudal2(dto: DateRangeDto): Promise<Metric[]> {
    try {
      const range = this.normalizeDateRange(dto);
      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: 'SSR_CUMPEO--slave.caudal_pozos' },
          order: { mt_time_2: 'DESC' },
          take: 100,
        });
        return results.reverse().map((r) => ({
          time: this.toLocalISOString(r.mt_time_2),
          value: Number(r.mt_value),
        }));
      }
      const results = await this.repo.find({
        where: {
          mt_name: 'SSR_CUMPEO--slave.caudal_pozos',
          mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
            start: range.start,
            end: range.end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });
      return results.map((r) => ({
        time: this.toLocalISOString(r.mt_time_2),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error(
        `Error en getCaudal con dto: ${JSON.stringify(dto)} - ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Calcula y cachea el horómetro diario (minutos de bomba encendida)
   * basándose en los intervalos de tiempo entre lecturas consecutivas
   * de una métrica de caudal donde mt_value > 0.
   * Hoy y ayer siempre se recalculan para mayor precisión.
   */
  private async calculateAndCacheDailyHorometro(
    caudalMetricName: string,
    cacheMetricName: string,
    start: string,
    end: string,
  ): Promise<Metric[]> {
    try {
      this.logger.log(
        `Iniciando calculateAndCacheDailyHorometro para ${caudalMetricName} entre ${start} y ${end}`,
      );

      const pad = (n: number) => String(n).padStart(2, '0');
      const toDateStr = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

      // 1. Obtener valores cacheados
      const cached = await this.repo.query(
        `SELECT mt_day, mt_value FROM ssr_cumpeo_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
        [cacheMetricName, start, end],
      );

      const metricsMap = new Map<string, number>();
      cached.forEach((row: any) =>
        metricsMap.set(
          typeof row.mt_day === 'string'
            ? row.mt_day.split('T')[0]
            : toDateStr(row.mt_day),
          Number(row.mt_value),
        ),
      );

      // 2. Determinar qué días faltan o deben recalcularse (hoy y ayer)
      const missingDates: string[] = [];
      const [sy, sm, sd] = start.split('-').map(Number);
      let currentDate = new Date(sy, sm - 1, sd);
      const [ey, em, ed] = end.split('-').map(Number);
      const endDate = new Date(ey, em - 1, ed);

      const today = new Date();
      const todayStr = toDateStr(today);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = toDateStr(yesterday);

      while (currentDate <= endDate) {
        const dateStr = toDateStr(currentDate);
        if (
          !metricsMap.has(dateStr) ||
          dateStr === todayStr ||
          dateStr === yesterdayStr
        )
          missingDates.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // 3. Calcular horómetro para los días faltantes
      if (missingDates.length > 0) {
        const calculated = await this.repo.query(
          `
          WITH readings AS (
            SELECT
              mt_time_2,
              CAST(mt_value AS NUMERIC(30,6)) AS value,
              mt_time_2::DATE AS day,
              LEAD(mt_time_2) OVER (PARTITION BY mt_time_2::DATE ORDER BY mt_time_2) AS next_time
            FROM ssr_cumpeo
            WHERE mt_name = $1
              AND mt_time_2::DATE = ANY($2::DATE[])
          )
          SELECT
            day,
            COALESCE(ROUND(SUM(
              CASE
                WHEN value > 0 AND next_time IS NOT NULL
                THEN EXTRACT(EPOCH FROM (next_time - mt_time_2)) / 60.0
                ELSE 0
              END
            )), 0)::INTEGER AS daily_value
          FROM readings
          GROUP BY day
          `,
          [caudalMetricName, missingDates],
        );

        for (const row of calculated) {
          const dateStr =
            typeof row.day === 'string'
              ? row.day.split('T')[0]
              : toDateStr(row.day);
          const value = Number(row.daily_value || 0);
          await this.repo.query(
            `INSERT INTO ssr_cumpeo_daily_metrics (mt_name, mt_day, mt_value) VALUES ($1, $2, $3) ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
            [cacheMetricName, dateStr, value],
          );
          metricsMap.set(dateStr, value);
        }
      }

      // 4. Armar respuesta ordenada
      const results: Metric[] = [];
      currentDate = new Date(sy, sm - 1, sd);
      while (currentDate <= endDate) {
        const dateStr = toDateStr(currentDate);
        if (metricsMap.has(dateStr))
          results.push({ time: dateStr, value: metricsMap.get(dateStr)! });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return results;
    } catch (error) {
      this.logger.error(
        `Error en calculateAndCacheDailyHorometro para ${caudalMetricName} [start=${start}, end=${end}]: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Horómetro calculado para el Pozo 2, basado en intervalos
   * donde SSR_CUMPEO--slave.caudal_pozos > 0.
   */
  async getHorometroPozo2(dto: DateRangeDto): Promise<Metric[]> {
    try {
      if (!dto?.start || !dto?.end)
        throw new Error('Rango inválido: start y end son requeridos');
      return await this.calculateAndCacheDailyHorometro(
        'SSR_CUMPEO--slave.caudal_pozos',
        'CALC--horometro_pozo2',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error(
        `Error en getHorometroPozo2 con dto: ${JSON.stringify(dto)} - ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
