import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

interface DailyQueryResult {
  day: string;
  daily_value: number;
}

@Injectable()
export class SsrRanguilService {
  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  private normalizeDateRange(
    dto: DateRangeDto,
  ): { start: Date; end: Date } | null {
    if (!dto.start || !dto.end) return null;

    const startDate = new Date(`${dto.start}T00:00:00Z`);

    const nextDay = new Date(dto.end);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDate = new Date(`${nextDay.toISOString().slice(0, 10)}T00:00:00Z`);

    console.log('🔹 [normalizeDateRange] DTO recibido:', dto);
    console.log(
      '🔹 [normalizeDateRange] Start (UTC):',
      startDate.toISOString(),
    );
    console.log('🔹 [normalizeDateRange] End (UTC):', endDate.toISOString());

    return { start: startDate, end: endDate };
  }

  /**
   * Retorna la última medición de cada sensor
   */
  async getSnapshot(): Promise<{
    snapshot: MetricSnapshot;
    tiempo_vaciado_est_1: number;
    tiempo_vaciado_est_1_formatted: string;
    tiempo_vaciado_est_2: number;
    tiempo_vaciado_est_2_formatted: string;
  }> {
    const results = await this.repo.query(`
    SELECT t.mt_name, t.mt_value, t.mt_time_2
    FROM ssr_ranguil t
    INNER JOIN (
      SELECT mt_name, MAX(mt_time_2) AS last_time
      FROM ssr_ranguil
      GROUP BY mt_name
    ) latest
    ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
  `);

    const prefix = 'SSR_RANGUIL--slave.';

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

    // --- Función reutilizable para calcular tiempo de vaciado
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

    // --- Aplicar a ambos estanques
    const est_1 = await calcularTiempoVaciado('SSR_RANGUIL--slave.estanque');
    const est_2 = await calcularTiempoVaciado('SSR_RANGUIL--slave.estanque_2');

    return {
      snapshot,
      tiempo_vaciado_est_1: est_1.tiempo,
      tiempo_vaciado_est_1_formatted: est_1.formatted,
      tiempo_vaciado_est_2: est_2.tiempo,
      tiempo_vaciado_est_2_formatted: est_2.formatted,
    };
  }

  /**
   * Totalizador diario
   */
  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    const range = dto;
    if (!range) throw new Error('Se requiere rango de fechas válido.');

    const start = range.start + ' 00:00:00';
    const end = range.end + ' 23:59:59';

    const results: DailyQueryResult[] = await this.repo.query(
      `
        WITH bounds AS (
          SELECT DATE(mt_time_2) AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_ranguil
          WHERE mt_name = 'SSR_RANGUIL--slave.totalizador'
          AND mt_time_2 BETWEEN ? AND ?
          GROUP BY DATE(mt_time_2)
        )
        SELECT b.day,
          (CAST(s_last.mt_value AS DECIMAL(30,6)) - CAST(s_first.mt_value AS DECIMAL(30,6))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_ranguil s_first
          ON s_first.mt_name = 'SSR_RANGUIL--slave.totalizador' AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_ranguil s_last
          ON s_last.mt_name = 'SSR_RANGUIL--slave.totalizador' AND s_last.mt_time_2 = b.last_ts
        ORDER BY b.day ASC
      `,
      [start, end],
    );

    return results.map((row) => ({
      time: row.day,
      value: Number(row.daily_value),
    }));
  }

  /**
   * Horómetro diario
   */
  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    const range = dto;
    if (!range) throw new Error('Se requiere rango de fechas válido.');

    const start = range.start + ' 00:00:00';
    const end = range.end + ' 23:59:59';

    const results: DailyQueryResult[] = await this.repo.query(
      `
        WITH bounds AS (
          SELECT DATE(mt_time_2) AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_ranguil
          WHERE mt_name = 'SSR_RANGUIL--slave.horometro'
          AND mt_time_2 BETWEEN ? AND ?
          GROUP BY DATE(mt_time_2)
        )
        SELECT b.day,
          (CAST(s_last.mt_value AS DECIMAL(30,6)) - CAST(s_first.mt_value AS DECIMAL(30,6))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_ranguil s_first
          ON s_first.mt_name = 'SSR_RANGUIL--slave.horometro' AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_ranguil s_last
          ON s_last.mt_name = 'SSR_RANGUIL--slave.horometro' AND s_last.mt_time_2 = b.last_ts
        ORDER BY b.day ASC
      `,
      [start, end],
    );

    return results.map((row) => ({
      time: row.day,
      value: Number(row.daily_value),
    }));
  }

  /**
   * Nivel de estanques
   */
  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);
    if (!range) {
      const results = await this.repo.find({
        where: { mt_name: 'SSR_RANGUIL--slave.estanque' },
        order: { mt_time_2: 'DESC' },
        take: 100,
      });

      return results.reverse().map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    }

    const { start, end } = range;

    const results = await this.repo.find({
      where: {
        mt_name: 'SSR_RANGUIL--slave.estanque',
        mt_time_2: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
          start,
          end,
        }),
      },
      order: { mt_time_2: 'ASC' },
    });

    return results.map((row) => ({
      time: row.mt_time_2.toISOString(),
      value: Number(row.mt_value),
    }));
  }

  /**
   * Nivel de estanque 2
   */
  async getNivel2(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);
    if (!range) {
      const results = await this.repo.find({
        where: { mt_name: 'SSR_RANGUIL--slave.estanque_2' },
        order: { mt_time_2: 'DESC' },
        take: 100,
      });

      return results.reverse().map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    }

    const { start, end } = range;

    const results = await this.repo.find({
      where: {
        mt_name: 'SSR_RANGUIL--slave.estanque_2',
        mt_time_2: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
          start,
          end,
        }),
      },
      order: { mt_time_2: 'ASC' },
    });

    return results.map((row) => ({
      time: row.mt_time_2.toISOString(),
      value: Number(row.mt_value),
    }));
  }

  /**
   * Caudal
   */
  async getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);

    if (!range) {
      const results = await this.repo.find({
        where: { mt_name: 'SSR_RANGUIL--slave.caudal' },
        order: { mt_time_2: 'DESC' },
        take: 100,
      });

      return results.reverse().map((row) => ({
        time: row.mt_time_2.toISOString(),
        value: Number(row.mt_value),
      }));
    }

    const { start, end } = range;

    const results = await this.repo.find({
      where: {
        mt_name: 'SSR_RANGUIL--slave.caudal',
        mt_time_2: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
          start,
          end,
        }),
      },
      order: { mt_time_2: 'ASC' },
    });

    return results.map((row) => ({
      time: row.mt_time_2.toISOString(),
      value: Number(row.mt_value),
    }));
  }
}
