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
export class SsrCaliforniaService {
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
    tiempo_vaciado_cerro: number;
    tiempo_vaciado_cerro_formatted: string;
    tiempo_vaciado_metalico: number;
    tiempo_vaciado_metalico_formatted: string;
  }> {
    const results = await this.repo.query(`
    SELECT t.mt_name, t.mt_value, t.mt_time_2
    FROM ssr_california t
    INNER JOIN (
      SELECT mt_name, MAX(mt_time_2) AS last_time
      FROM ssr_california
      GROUP BY mt_name
    ) latest
    ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
  `);

    const snapshot: MetricSnapshot = results.reduce(
      (acc: MetricSnapshot, row: any) => {
        const key = row.mt_name;
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
        where: { name: nombreEstanque },
        order: { insert_time: 'DESC' },
        take: 2,
      });

      if (mediciones.length < 2) {
        return { tiempo: 0, formatted: 'Llenando...' };
      }

      const [actual, anterior] = mediciones;
      const nivel_actual = Number(actual.value);
      const nivel_anterior = Number(anterior.value);

      const t_actual = actual.insert_time.getTime() / 1000;
      const t_anterior = anterior.insert_time.getTime() / 1000;

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

    const estanqueCerro = await calcularTiempoVaciado(
      'SALA_BOMBA_NIVEL_CERRO',
    );
    const estanqueMetalico = await calcularTiempoVaciado(
      'SALA_BOMBA_NIVEL_METALICO',
    );

    return {
      snapshot,
      tiempo_vaciado_cerro: estanqueCerro.tiempo,
      tiempo_vaciado_cerro_formatted: estanqueCerro.formatted,
      tiempo_vaciado_metalico: estanqueMetalico.tiempo,
      tiempo_vaciado_metalico_formatted: estanqueMetalico.formatted,
    };
  }

  // Totalizador
  async getTotalizador(dto: DateRangeDto): Promise<Metric[]> {
    const range = dto;
    if (!range) throw new Error('Se requiere rango de fechas válido.');

    const start = range.start + ' 00:00:00';
    const end = range.end + ' 23:59:59';

    const results: DailyQueryResult[] = await this.repo.query(
      `
        WITH bounds AS (
          SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_california
          WHERE mt_name = 'SALA_BOMBA_TOTALIZADOR'
          AND mt_time_2 BETWEEN $1 AND $2
          GROUP BY mt_time_2::DATE
        )
        SELECT b.day,
          (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_california s_first
          ON s_first.mt_name = 'SALA_BOMBA_TOTALIZADOR' AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_california s_last
          ON s_last.mt_name = 'SALA_BOMBA_TOTALIZADOR' AND s_last.mt_time_2 = b.last_ts
        GROUP BY b.day
        ORDER BY b.day ASC
      `,
      [start, end],
    );

    return results.map((row) => ({
      time: typeof row.day === 'string' ? row.day : row.day.toISOString().split('T')[0],
      value: Number(row.daily_value),
    }));
  }

  // Horometro
  async getHorometro(dto: DateRangeDto): Promise<Metric[]> {
    const range = dto;
    if (!range) throw new Error('Se requiere rango de fechas válido.');

    const start = range.start + ' 00:00:00';
    const end = range.end + ' 23:59:59';

    const results: DailyQueryResult[] = await this.repo.query(
      `
        WITH bounds AS (
          SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_california
          WHERE mt_name = 'SALA_BOMBA_HOROMETRO'
          AND mt_time_2 BETWEEN $1 AND $2
          GROUP BY mt_time_2::DATE
        )
        SELECT b.day,
          (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_california s_first
          ON s_first.mt_name = 'SALA_BOMBA_HOROMETRO' AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_california s_last
          ON s_last.mt_name = 'SALA_BOMBA_HOROMETRO' AND s_last.mt_time_2 = b.last_ts
        GROUP BY b.day
        ORDER BY b.day ASC
      `,
      [start, end],
    );

    return results.map((row) => ({
      time: typeof row.day === 'string' ? row.day : row.day.toISOString().split('T')[0],
      value: Number(row.daily_value),
    }));
  }

  // Nivel
  async getNivel(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);
    if (!range) {
      const results = await this.repo.find({
        where: { name: 'SALA_BOMBA_NIVEL_CERRO' },
        order: { insert_time: 'DESC' },
        take: 100,
      });

      return results.reverse().map((row) => ({
        time: row.insert_time.toISOString(),
        value: Number(row.value),
      }));
    }

    const { start, end } = range;

    const results = await this.repo.find({
      where: {
        name: 'SALA_BOMBA_NIVEL_CERRO',
        insert_time: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
          start,
          end,
        }),
      },
      order: { insert_time: 'ASC' },
    });

    return results.map((row) => ({
      time: row.insert_time.toISOString(),
      value: Number(row.value),
    }));
  }

  // Nivel 2
  async getNivel2(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);
    if (!range) {
      const results = await this.repo.find({
        where: { name: 'SALA_BOMBA_NIVEL_METALICO' },
        order: { insert_time: 'DESC' },
        take: 100,
      });

      return results.reverse().map((row) => ({
        time: row.insert_time.toISOString(),
        value: Number(row.value),
      }));
    }

    const { start, end } = range;

    const results = await this.repo.find({
      where: {
        name: 'SALA_BOMBA_NIVEL_METALICO',
        insert_time: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
          start,
          end,
        }),
      },
      order: { insert_time: 'ASC' },
    });

    return results.map((row) => ({
      time: row.insert_time.toISOString(),
      value: Number(row.value),
    }));
  }

  // Caudal
  async getCaudal(dto: DateRangeDto): Promise<Metric[]> {
    const range = this.normalizeDateRange(dto);

    if (!range) {
      const results = await this.repo.find({
        where: { name: 'SALA_BOMBA_CAUDAL' },
        order: { insert_time: 'DESC' },
        take: 100,
      });

      return results.reverse().map((row) => ({
        time: row.insert_time.toISOString(),
        value: Number(row.value),
      }));
    }

    const { start, end } = range;

    const results = await this.repo.find({
      where: {
        name: 'SALA_BOMBA_CAUDAL',
        insert_time: Raw((alias) => `${alias} >= :start AND ${alias} < :end`, {
          start,
          end,
        }),
      },
      order: { insert_time: 'ASC' },
    });

    return results.map((row) => ({
      time: row.insert_time.toISOString(),
      value: Number(row.value),
    }));
  }
}