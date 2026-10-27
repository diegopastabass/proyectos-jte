import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

@Injectable()
export class SsrGonzalezService {
  private readonly logger = new Logger(SsrGonzalezService.name);

  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  /**
   * Convierte una fecha "YYYY-MM-DD" en un Date que representa
   * la medianoche en America/Santiago (respeta DST automáticamente).
   *
   * Ejemplo: '2026-10-15' → 2026-10-15T03:00:00.000Z  (UTC-3, verano)
   */
  private localMidnight(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);

    // Usamos mediodía UTC como referencia: en esa fecha siempre cae en
    // el mismo día local Santiago, sin riesgo de cruzar la medianoche.
    const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

    // Obtener el offset del timezone en ese instante vía formatToParts
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
      timeZoneName: 'shortOffset',
    }).formatToParts(noonUTC);

    const offsetStr =
      parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';

    // offsetStr es 'GMT-3', 'GMT-4', etc.
    const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
    const sign = match?.[1] === '+' ? 1 : -1;
    const hours = parseInt(match?.[2] ?? '0', 10);
    const minutes = parseInt(match?.[3] ?? '0', 10);
    const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;

    // Medianoche Santiago en UTC = 00:00:00 local - offset
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offsetMs);
  }

  private normalizeDateRange(
    dto: DateRangeDto,
  ): { start: Date; end: Date } | null {
    if (!dto.start || !dto.end) return null;

    const startDate = this.localMidnight(dto.start);

    // El fin es medianoche del día SIGUIENTE al end pedido
    const [ey, em, ed] = dto.end.split('-').map(Number);
    const nextDayStr = new Date(Date.UTC(ey, em - 1, ed + 1))
      .toISOString()
      .slice(0, 10);
    const endDate = this.localMidnight(nextDayStr);

    return { start: startDate, end: endDate };
  }


  async getSnapshot() {
    try {
      const results = await this.repo.query(`
        SELECT t.mt_name, t.mt_value, t.mt_time_2
        FROM ssr_gonzalez t
        INNER JOIN (
          SELECT mt_name, MAX(mt_time_2) AS last_time
          FROM ssr_gonzalez
          GROUP BY mt_name
        ) latest
        ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
      `);

      const prefix = 'SSR_GONZALEZ--slave.';
      const snapshot: MetricSnapshot = results.reduce(
        (acc: MetricSnapshot, row: any) => {
          const key = row.mt_name.replace(prefix, '');
          acc[key] = {
            value: Number(row.mt_value),
            time: new Date(row.mt_time_2).toISOString(),
          };
          return acc;
        },
        {},
      );

      const calcularTiempoVaciado = async (nombreEstanque: string) => {
        const mediciones = await this.repo.find({
          where: { mt_name: nombreEstanque },
          order: { mt_time_2: 'DESC' },
          take: 2,
        });
        if (mediciones.length < 2)
          return { tiempo: 0, formatted: 'Llenando...' };
        const [actual, anterior] = mediciones;
        const [nivel_actual, nivel_anterior] = [
          Number(actual.mt_value),
          Number(anterior.mt_value),
        ];
        if (nivel_actual == nivel_anterior)
          return { tiempo: 0, formatted: 'Nivel Estático' };
        const [t_actual, t_anterior] = [
          actual.mt_time_2.getTime() / 1000,
          anterior.mt_time_2.getTime() / 1000,
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
      };

      const estanque1 = await calcularTiempoVaciado(
        'SSR_GONZALEZ--slave.metalico1',
      );
      const estanque2 = await calcularTiempoVaciado(
        'SSR_GONZALEZ--slave.metalico2',
      );

      return {
        snapshot,
        tiempo_vaciado: estanque1.tiempo,
        tiempo_vaciado_formatted: estanque1.formatted,
        tiempo_vaciado_2: estanque2.tiempo,
        tiempo_vaciado_2_formatted: estanque2.formatted,
      };
    } catch (error) {
      this.logger.error('Error en getSnapshot', error);
      throw error;
    }
  }

  private async calculateAndCacheDaily(
    metricName: string,
    start: string,
    end: string,
  ): Promise<Metric[]> {
    try {
      const cached = await this.repo.query(
        `SELECT mt_day, mt_value FROM ssr_gonzalez_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
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
        if (!metricsMap.has(dateStr) || dateStr === todayStr)
          missingDates.push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (missingDates.length > 0) {
        const calculated = await this.repo.query(
          `
          WITH bounds AS (
            SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
            FROM ssr_gonzalez
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day, (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_gonzalez s_first ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_gonzalez s_last ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
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
            `INSERT INTO ssr_gonzalez_daily_metrics (mt_name, mt_day, mt_value) VALUES ($1, $2, $3) ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
            [metricName, dateStr, val],
          );
          metricsMap.set(dateStr, val);
        }
      }

      const results: Metric[] = [];
      currentDate = new Date(`${start}T00:00:00Z`);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        if (metricsMap.has(dateStr))
          results.push({ time: dateStr, value: metricsMap.get(dateStr)! });
        currentDate.setDate(currentDate.getDate() + 1);
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

  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    this.logger.debug(`getTotalizador recibido: ${JSON.stringify(dto)}`);
    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango de fechas inválido');
      return await this.calculateAndCacheDaily(
        'SSR_GONZALEZ--slave.totalizador',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error('Error en getTotalizador', error);
      throw error;
    }
  }

  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    this.logger.debug(`getHorometro recibido: ${JSON.stringify(dto)}`);
    try {
      if (!dto?.start || !dto?.end) throw new Error('Rango de fechas inválido');
      return await this.calculateAndCacheDaily(
        'SSR_GONZALEZ--slave.horometro',
        dto.start,
        dto.end,
      );
    } catch (error) {
      this.logger.error('Error en getHorometro', error);
      throw error;
    }
  }

  // Lee ?limit= de la query; si no viene o no es válido usa el valor por defecto.
  // Tope de 5000 filas para no sobrecargar la BD.
  private parseLimit(limit: unknown, porDefecto: number): number {
    const n = Number(limit);
    if (!limit || !Number.isFinite(n) || n <= 0) return porDefecto;
    return Math.min(Math.floor(n), 5000);
  }

  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    this.logger.debug(`getNivel recibido: ${JSON.stringify(dto)}`);
    try {
      const range = this.normalizeDateRange(dto);
      const name = 'SSR_GONZALEZ--slave.metalico1';
      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: name },
          order: { mt_time_2: 'DESC' },
          take: this.parseLimit(dto.limit, 100),
        });
        return results
          .reverse()
          .map((r) => ({
            time: r.mt_time_2.toISOString(),
            value: Number(r.mt_value),
          }));
      }
      const results = await this.repo.find({
        where: {
          mt_name: name,
          mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
            start: range.start,
            end: range.end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });
      return results.map((r) => ({
        time: r.mt_time_2.toISOString(),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error('Error en getNivel', error);
      throw error;
    }
  }

  async getNivel2(dto: DateRangeDto): Promise<Metric[]> {
    this.logger.debug(`getNivel2 recibido: ${JSON.stringify(dto)}`);
    try {
      const range = this.normalizeDateRange(dto);
      const name = 'SSR_GONZALEZ--slave.metalico2';
      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: name },
          order: { mt_time_2: 'DESC' },
          take: this.parseLimit(dto.limit, 100),
        });
        return results
          .reverse()
          .map((r) => ({
            time: r.mt_time_2.toISOString(),
            value: Number(r.mt_value),
          }));
      }
      const results = await this.repo.find({
        where: {
          mt_name: name,
          mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
            start: range.start,
            end: range.end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });
      return results.map((r) => ({
        time: r.mt_time_2.toISOString(),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error('Error en getNivel2', error);
      throw error;
    }
  }

  async getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    this.logger.debug(`getCaudal recibido: ${JSON.stringify(dto)}`);
    try {
      const range = this.normalizeDateRange(dto);
      const name = 'SSR_GONZALEZ--slave.caudal';
      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: name },
          order: { mt_time_2: 'DESC' },
          take: 100,
        });
        return results
          .reverse()
          .map((r) => ({
            time: r.mt_time_2.toISOString(),
            value: Number(r.mt_value),
          }));
      }
      const results = await this.repo.find({
        where: {
          mt_name: name,
          mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
            start: range.start,
            end: range.end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });
      return results.map((r) => ({
        time: r.mt_time_2.toISOString(),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error('Error en getCaudal', error);
      throw error;
    }
  }

  async getPh(dto: DateRangeDto): Promise<Metric[]> {
    this.logger.debug(`getPh recibido: ${JSON.stringify(dto)}`);
    try {
      const range = this.normalizeDateRange(dto);
      const name = 'SSR_GONZALEZ--slave.ph';
      if (!range) {
        const results = await this.repo.find({
          where: { mt_name: name },
          order: { mt_time_2: 'DESC' },
          take: 100,
        });
        return results
          .reverse()
          .map((r) => ({
            time: r.mt_time_2.toISOString(),
            value: Number(r.mt_value),
          }));
      }
      const results = await this.repo.find({
        where: {
          mt_name: name,
          mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
            start: range.start,
            end: range.end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });
      return results.map((r) => ({
        time: r.mt_time_2.toISOString(),
        value: Number(r.mt_value),
      }));
    } catch (error) {
      this.logger.error('Error en getPh', error);
      throw error;
    }
  }
}
