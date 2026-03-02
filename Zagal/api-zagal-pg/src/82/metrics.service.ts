// 82/services/metrics.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parc82Zagal } from './parc82.entity';

export interface LatestMetricResult {
  caudal: number;
  totalizador: number;
}

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Parc82Zagal)
    private readonly repo: Repository<Parc82Zagal>,
  ) {}

  private sectorMap: { [key: string]: string } = {
    'PARC_82_ZAGAL--slave.sector1': 'SECTOR 1',
    'PARC_82_ZAGAL--slave.sector2': 'SECTOR 2',
    'PARC_82_ZAGAL--slave.sector3': 'SECTOR 3',
    'PARC_82_ZAGAL--slave.sector4': 'SECTOR 4',
    'PARC_82_ZAGAL--slave.sector5': 'SECTOR 5',
    'PARC_82_ZAGAL--slave.sector6': 'SECTOR 6',
    'PARC_82_ZAGAL--slave.sector8': 'SECTOR 8',
    'PARC_82_ZAGAL--slave.sector9': 'SECTOR 9',
    'PARC_82_ZAGAL--slave.sector10': 'SECTOR 10',
    'PARC_82_ZAGAL--slave.sector11': 'SECTOR 11',
    'PARC_82_ZAGAL--slave.sector12': 'SECTOR 12',
  };

  private sectorAreas: Record<string, number> = {
    'PARC_82_ZAGAL--slave.sector1': 26.506,
    'PARC_82_ZAGAL--slave.sector2': 30.83,
    'PARC_82_ZAGAL--slave.sector3': 24.285,
    'PARC_82_ZAGAL--slave.sector4': 25.004,
    'PARC_82_ZAGAL--slave.sector5': 21.627,
    'PARC_82_ZAGAL--slave.sector6': 31.402,
    'PARC_82_ZAGAL--slave.sector8': 38.582,
    'PARC_82_ZAGAL--slave.sector9': 49.638,
    'PARC_82_ZAGAL--slave.sector10': 33.918,
    'PARC_82_ZAGAL--slave.sector11': 45.702,
    'PARC_82_ZAGAL--slave.sector12': 45.224,
  };

  private mapParcela(name: string): string {
    return this.sectorMap[name] || name;
  }

  // OPTIMIZACIÓN POSTGRES: Uso de DISTINCT ON para obtener el último registro de cada tipo
  async findLatest(): Promise<LatestMetricResult> {
    try {
      const rows = await this.repo.query(`
        SELECT DISTINCT ON (mt_name) mt_name, mt_value
        FROM parc_82_zagal
        WHERE mt_name IN ('PARC_82_ZAGAL--slave.caudal', 'PARC_82_ZAGAL--slave.totalizador')
        ORDER BY mt_name, mt_time_2 DESC
      `);

      const result: LatestMetricResult = { caudal: 0, totalizador: 0 };

      for (const row of rows) {
        const value = Number(row.mt_value); // Convertir varchar a numero
        if (row.mt_name.includes('caudal')) result.caudal = value;
        if (row.mt_name.includes('totalizador'))
          result.totalizador = value / 10;
      }

      return result;
    } catch (error) {
      console.error('Error fetching latest metrics:', error);
      throw new InternalServerErrorException('Error fetching latest metrics');
    }
  }

  // Refactorizado con DISTINCT ON (mucho más rápido que JOIN con subquery)
  async activeSectors(): Promise<{ mt_name: string; is_active: number }[]> {
    try {
      const rows = await this.repo.query(`
        SELECT DISTINCT ON (mt_name) mt_name, mt_value
        FROM parc_82_zagal
        WHERE mt_name LIKE '%sector%'
        ORDER BY mt_name, mt_time_2 DESC
      `);

      const statusMap: Record<string, number> = {};
      rows.forEach((row) => {
        // En Postgres comparamos string '1', no number 1
        statusMap[row.mt_name] = row.mt_value === '1' ? 1 : 0;
      });

      return Object.keys(this.sectorMap).map((key) => ({
        mt_name: this.sectorMap[key],
        is_active: statusMap[key] || 0,
      }));
    } catch (error) {
      console.error('Error fetching active sectors:', error);
      throw new InternalServerErrorException('Error fetching active sectors');
    }
  }

  // Refactorizado usando TypeORM puro para consultas simples
  async findLatestByName(name: string): Promise<Parc82Zagal | null> {
    try {
      const metric = await this.repo.findOne({
        where: { mt_name: name },
        order: { mt_time_2: 'DESC' },
      });
      if (metric) metric.mt_name = this.mapParcela(metric.mt_name);
      return metric;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching latest metric by name',
      );
    }
  }

  // Refactorizado con DISTINCT ON
  async findLatestForEachName(): Promise<{ [key: string]: number }> {
    try {
      const rows = await this.repo.query(`
        SELECT DISTINCT ON (mt_name) mt_name, mt_value
        FROM parc_82_zagal
        ORDER BY mt_name, mt_time_2 DESC
      `);

      const result: { [key: string]: number } = {};
      rows.forEach((row) => {
        result[this.mapParcela(row.mt_name)] = Number(row.mt_value);
      });
      return result;
    } catch (error) {
      console.error('Error fetching latest metrics for all:', error);
      throw new InternalServerErrorException('Error fetching metrics');
    }
  }

  // Refactorizado usando funciones de TypeORM
  async findLastUpdateTime(): Promise<Date | null> {
    try {
      const result = await this.repo
        .createQueryBuilder('p')
        .select('MAX(p.mt_time_2)', 'max')
        .getRawOne();
      return result ? result.max : null;
    } catch (error) {
      console.error('Error fetching last update:', error);
      throw new InternalServerErrorException('Error fetching last update');
    }
  }

  // findIrrigationInterval
  async findIrrigationInterval() {
    try {
      const intervalRows = await this.repo.query(
        `SELECT * FROM zagal_82_interval`,
      );

      const activeSectors = intervalRows.filter(
        (r: any) => r.is_active === '1',
      );
      const activeNames = activeSectors.map((r: any) => r.mt_name);

      const totalActiveArea = activeNames.reduce((sum, name) => {
        return sum + (this.sectorAreas[name] || 0);
      }, 0);

      const allSectors = Object.keys(this.sectorMap);
      const now = new Date().getTime();

      return allSectors.map((mt_name) => {
        const row = intervalRows.find((r: any) => r.mt_name === mt_name);
        const is_active = row && row.is_active === '1';
        const sinceTime = row ? new Date(row.since).getTime() : now;

        let tiempo_riego_segundos = 0;
        let sectorTotalizer = 0;

        if (is_active) {
          tiempo_riego_segundos = Math.floor((now - sinceTime) / 1000);

          const first = row.first_totalizador
            ? Number(row.first_totalizador)
            : 0;
          const last = row.last_totalizador ? Number(row.last_totalizador) : 0;
          const rawDelta = Math.max(0, last - first);

          if (totalActiveArea > 0) {
            const sectorArea = this.sectorAreas[mt_name] || 0;
            const ratio = sectorArea / totalActiveArea;
            sectorTotalizer = rawDelta * ratio;
          }
        }

        return {
          mt_name: this.sectorMap[mt_name],
          is_active: is_active ? 1 : 0,
          tiempo_riego_segundos,
          totalizador: sectorTotalizer,
        };
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching irrigation interval',
      );
    }
  }

  // getDailyIrrigationSummary
  async getDailyIrrigationSummary(startDate: string, endDate: string) {
    try {
      const checkLogs = await this.repo.query(
        `
      SELECT COUNT(*) as count 
      FROM zagal_82_irrigation_log 
      WHERE start_time >= $1::timestamp 
        AND start_time < $2::timestamp + INTERVAL '1 day'
    `,
        [startDate, endDate],
      );

      if (Number(checkLogs[0].count) === 0) {
        await this.repo.query(
          `
        WITH ordered AS (
          SELECT 
            mt_name, mt_value, mt_time_2,
            LAG(mt_value) OVER (PARTITION BY mt_name ORDER BY mt_time_2) AS prev_value,
            LAG(mt_time_2) OVER (PARTITION BY mt_name ORDER BY mt_time_2) AS prev_time
          FROM parc_82_zagal
          WHERE mt_name LIKE '%sector%'
            AND mt_time_2 >= $1::timestamp
            AND mt_time_2 < $2::timestamp + INTERVAL '1 day'
        )
        INSERT INTO zagal_82_irrigation_log (mt_name, start_time, end_time)
        SELECT mt_name, prev_time, mt_time_2
        FROM ordered
        WHERE prev_value = '1' AND mt_value = '1'
      `,
          [startDate, endDate],
        );
      }

      const query = `
    WITH intervalos AS (
        SELECT 
            mt_name,
            start_time::date AS date,
            start_time AS inicio,
            COALESCE(end_time, CURRENT_TIMESTAMP) AS fin,
            EXTRACT(EPOCH FROM (COALESCE(end_time, CURRENT_TIMESTAMP) - start_time)) AS tiempo_riego
        FROM zagal_82_irrigation_log
        WHERE start_time >= $1::timestamp 
          AND start_time < $2::timestamp + INTERVAL '1 day'
    ),
    totalizador_series AS (
        SELECT
            mt_time_2,
            NULLIF(mt_value, '')::numeric AS totalizador_value,
            LAG(NULLIF(mt_value, '')::numeric) OVER (ORDER BY mt_time_2) AS prev_totalizador
        FROM parc_82_zagal
        WHERE mt_name = 'PARC_82_ZAGAL--slave.totalizador'
          AND mt_time_2 BETWEEN $1::timestamp AND $2::timestamp + INTERVAL '1 day'
    ),
    totalizador_increments AS (
        SELECT mt_time_2, (totalizador_value - prev_totalizador) AS delta_totalizador
        FROM totalizador_series
        WHERE prev_totalizador IS NOT NULL AND (totalizador_value - prev_totalizador) >= 0
    ),
    active_count AS (
        SELECT t.mt_time_2, COUNT(DISTINCT s.mt_name) AS n_activos
        FROM totalizador_increments t
        JOIN intervalos s ON t.mt_time_2 BETWEEN s.inicio AND s.fin
        GROUP BY t.mt_time_2
    ),
    weighted AS (
        SELECT t.mt_time_2, t.delta_totalizador / COALESCE(a.n_activos, 1) AS delta_por_sector
        FROM totalizador_increments t
        LEFT JOIN active_count a USING (mt_time_2)
    ),
    final_calc AS (
        SELECT s.mt_name, s.date, SUM(w.delta_por_sector) AS totalizador
        FROM intervalos s
        JOIN weighted w ON w.mt_time_2 BETWEEN s.inicio AND s.fin
        GROUP BY s.mt_name, s.date
    ),
    caudal_avg AS (
       SELECT i.mt_name, i.date,
       (SELECT AVG(NULLIF(c.mt_value, '')::numeric) 
        FROM parc_82_zagal c 
        WHERE c.mt_name = 'PARC_82_ZAGAL--slave.caudal' AND c.mt_time_2 BETWEEN i.inicio AND i.fin
       ) as caudal
       FROM intervalos i
    )
    SELECT 
        i.mt_name, 
        i.date, 
        SUM(i.tiempo_riego) AS value,
        COALESCE(SUM(fc.totalizador), 0) AS totalizador,
        COALESCE(AVG(ca.caudal), 0) AS caudal
    FROM intervalos i
    LEFT JOIN final_calc fc ON i.mt_name = fc.mt_name AND i.date = fc.date
    LEFT JOIN caudal_avg ca ON i.mt_name = ca.mt_name AND i.date = ca.date
    GROUP BY i.mt_name, i.date
    ORDER BY i.mt_name, i.date
    `;

      const rows = await this.repo.query(query, [startDate, endDate]);

      return rows.map((r) => ({
        mt_name: this.mapParcela(r.mt_name),
        date: r.date,
        value: Number(r.value),
        totalizador: Number(r.totalizador),
        caudal: Number(r.caudal),
      }));
    } catch (error) {
      throw new InternalServerErrorException(
        'Error fetching irrigation summary',
      );
    }
  }
}
