import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import { MetricSnapshot, Metric } from './models/types';

interface DailyQueryResult {
  day: Date;
  daily_value: number;
}

@Injectable()
export class SsrPuQuillayService {
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

    return { start: startDate, end: endDate };
  }

  // Snapshot
  async getSnapshot(): Promise<{
    snapshot: MetricSnapshot;
    tiempo_vaciado: number;
    tiempo_vaciado_formatted: string;
  }> {
    const results = await this.repo.query(`
    SELECT t.mt_name, t.mt_value, t.mt_time_2
    FROM ssr_puquillay t
    INNER JOIN (
      SELECT mt_name, MAX(mt_time_2) AS last_time
      FROM ssr_puquillay
      GROUP BY mt_name
    ) latest
    ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
  `);

    const prefix = 'SSR_PUQUILLAY--slave.';

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

    const estanque = await calcularTiempoVaciado(
      'SSR_PUQUILLAY--slave.estanque',
    );

    return {
      snapshot,
      tiempo_vaciado: estanque.tiempo,
      tiempo_vaciado_formatted: estanque.formatted,
    };
  }

  // Daily Metrics
  private async calculateAndCacheDaily(
    metricName: string,
    start: string,
    end: string,
  ): Promise<Metric[]> {
    const cached = await this.repo.query(
      `SELECT mt_day, mt_value FROM ssr_puquillay_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
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
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (missingDates.length > 0) {
      const calculated = await this.repo.query(
        `
        WITH bounds AS (
          SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_puquillay
          WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
          GROUP BY mt_time_2::DATE
        )
        SELECT b.day,
          (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_puquillay s_first
          ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_puquillay s_last
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
          `INSERT INTO ssr_puquillay_daily_metrics (mt_name, mt_day, mt_value) 
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
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  // Totalizador
  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    if (!dto || !dto.start || !dto.end)
      throw new Error('Se requiere rango de fechas válido.');
    return this.calculateAndCacheDaily(
      'SSR_PUQUILLAY--slave.totalizador',
      dto.start,
      dto.end,
    );
  }

  // Horometro — calculado a partir del caudal (caudal > 0 => bomba encendida)
  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    if (!dto || !dto.start || !dto.end)
      throw new Error('Se requiere rango de fechas válido.');

    const metricName = 'SSR_PUQUILLAY--slave.horometro';
    const { start, end } = dto;

    // 1. Leer caché existente
    const cached = await this.repo.query(
      `SELECT mt_day, mt_value FROM ssr_puquillay_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
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

    // 2. Determinar días que faltan o corresponden a hoy (se recalculan)
    const missingDates: string[] = [];
    let currentDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    const todayStr = new Date().toISOString().split('T')[0];

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (!metricsMap.has(dateStr) || dateStr === todayStr) {
        missingDates.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 3. Calcular minutos de bomba encendida para los días que faltan
    if (missingDates.length > 0) {
      // Obtener todas las lecturas de caudal de los días faltantes ordenadas por tiempo
      const readings = await this.repo.query(
        `
        SELECT mt_time_2, mt_value, mt_time_2::DATE AS day
        FROM ssr_puquillay
        WHERE mt_name = 'SSR_PUQUILLAY--slave.caudal'
          AND mt_time_2::DATE = ANY($1::DATE[])
        ORDER BY mt_time_2 ASC
        `,
        [missingDates],
      );

      // Agrupar lecturas por día
      const readingsByDay = new Map<string, { time: Date; value: number }[]>();
      for (const row of readings) {
        const dateStr =
          typeof row.day === 'string'
            ? row.day
            : (row.day as Date).toISOString().split('T')[0];
        if (!readingsByDay.has(dateStr)) readingsByDay.set(dateStr, []);
        readingsByDay.get(dateStr)!.push({
          time: new Date(row.mt_time_2),
          value: Number(row.mt_value),
        });
      }

      // Calcular minutos encendido por día integrando intervalos con caudal > 0
      for (const dateStr of missingDates) {
        const dayReadings = readingsByDay.get(dateStr) ?? [];
        let minutesOn = 0;

        for (let i = 0; i < dayReadings.length - 1; i++) {
          const current = dayReadings[i];
          const next = dayReadings[i + 1];
          if (current.value > 0) {
            const diffMs = next.time.getTime() - current.time.getTime();
            minutesOn += diffMs / 60000;
          }
        }

        const val = Math.round(minutesOn);

        await this.repo.query(
          `INSERT INTO ssr_puquillay_daily_metrics (mt_name, mt_day, mt_value)
           VALUES ($1, $2, $3)
           ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
          [metricName, dateStr, val],
        );

        metricsMap.set(dateStr, val);
      }
    }

    // 4. Construir y retornar el arreglo de Metric[]
    const results: Metric[] = [];
    currentDate = new Date(`${start}T00:00:00Z`);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      if (metricsMap.has(dateStr)) {
        results.push({ time: dateStr, value: metricsMap.get(dateStr)! });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  // Nivel
  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);
    if (!range) {
      const results = await this.repo.find({
        where: { mt_name: 'SSR_PUQUILLAY--slave.estanque' },
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
        mt_name: 'SSR_PUQUILLAY--slave.estanque',
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

  // Caudal
  async getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);

    if (!range) {
      const results = await this.repo.find({
        where: { mt_name: 'SSR_PUQUILLAY--slave.caudal' },
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
        mt_name: 'SSR_PUQUILLAY--slave.caudal',
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

  async getPh(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);

    if (!range) {
      const results = await this.repo.find({
        where: { mt_name: 'SSR_PUQUILLAY--slave.ph' },
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
        mt_name: 'SSR_PUQUILLAY--slave.ph',
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
