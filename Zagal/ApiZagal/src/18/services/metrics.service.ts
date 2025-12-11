// metrics.service.ts
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { DatabaseConfig } from "../../config/database.config";
import { Metric } from "../models/metric.interface";
import { RiegoResponse } from "../models/riego-response.dto";

export interface LatestMetricResult {
  caudal: number;
  totalizador: number;
}

interface DbRow {
  mt_name: string;
  mt_value: number;
}

@Injectable()
export class MetricsService {
  constructor(private readonly dbConfig: DatabaseConfig) {}

  private sectorMap: { [key: string]: string } = {
    "PARC_18_ZAGAL--slave.sector1": "SECTOR 1",
    "PARC_18_ZAGAL--slave.sector2": "SECTOR 2",
    "PARC_18_ZAGAL--slave.sector3": "SECTOR 3",
    "PARC_18_ZAGAL--slave.sector4": "SECTOR 4",
    "PARC_18_ZAGAL--slave.sector5": "SECTOR 5",
    "PARC_18_ZAGAL--slave.sector6": "SECTOR 6",
    "PARC_18_ZAGAL--slave.sector7": "SECTOR 7",
    "PARC_18_ZAGAL--slave.sector8": "SECTOR 8",
    "PARC_18_ZAGAL--slave.sector9": "SECTOR 9",
  };

  private mapParcela(name: string): string {
    return this.sectorMap[name] || name;
  }

  async findLatest(): Promise<LatestMetricResult> {
    const SQL_QUERY = `
      SELECT
          sub.mt_name,
          sub.mt_value
      FROM
          (
              SELECT
                  mt_name,
                  mt_value,
                  ROW_NUMBER() OVER (PARTITION BY mt_name ORDER BY mt_time_2 DESC) as rn
              FROM
                  parc_18_zagal
              WHERE
                  mt_name IN ('PARC_18_ZAGAL--slave.caudal', 'PARC_18_ZAGAL--slave.totalizador')
          ) AS sub
      WHERE
          sub.rn = 1;
    `;

    try {
      const [rows] = await this.dbConfig.pool.query(SQL_QUERY);
      const metrics: DbRow[] = rows as DbRow[];

      if (metrics.length === 0) {
        return { caudal: 0, totalizador: 0 };
      }

      const result: LatestMetricResult = {
        caudal: 0,
        totalizador: 0,
      };

      for (const row of metrics) {
        const value = Number(row.mt_value);

        if (row.mt_name === "PARC_18_ZAGAL--slave.caudal") {
          result.caudal = value;
        } else if (row.mt_name === "PARC_18_ZAGAL--slave.totalizador") {
          result.totalizador = value / 10;
        }
      }

      return result;
    } catch (error) {
      console.error("Database Error:", error);
      throw new InternalServerErrorException("Error fetching latest metrics");
    }
  }

  async findLatestByName(name: string): Promise<Metric | null> {
    try {
      const [rows] = await this.dbConfig.pool.query(
        "SELECT mt_id, mt_name, mt_value, mt_time_2 FROM parc_18_zagal WHERE mt_name = ? ORDER BY mt_time_2 DESC LIMIT 1",
        [name]
      );
      const metrics = rows as Metric[];
      if (metrics.length > 0) {
        metrics[0].mt_name = this.mapParcela(metrics[0].mt_name);
        return metrics[0];
      }
      return null;
    } catch (error) {
      throw new InternalServerErrorException(
        "Error fetching latest metric by name"
      );
    }
  }

  async findLatestForEachName(): Promise<{ [key: string]: number }> {
    try {
      const [rows] = await this.dbConfig.pool.query(
        `SELECT m1.mt_name, m1.mt_value
         FROM parc_18_zagal m1
         JOIN (
             SELECT mt_name, MAX(mt_time_2) AS max_time
             FROM parc_18_zagal
             GROUP BY mt_name
         ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time;`
      );

      const result: { [key: string]: number } = {};
      (rows as Metric[]).forEach((row: Metric) => {
        const parcela = this.mapParcela(row.mt_name);
        result[parcela] = row.mt_value;
      });
      return result;
    } catch (error) {
      console.error("Error fetching latest metrics for all names:", error);
      throw new InternalServerErrorException(
        "Error fetching latest metrics for all names"
      );
    }
  }

  async findLastUpdateTime(): Promise<Date | null> {
    try {
      const [rows] = await this.dbConfig.pool.query(
        "SELECT MAX(mt_time_2) AS last_update FROM parc_18_zagal"
      );
      const result = (rows as { last_update: string | null }[])[0];
      return result && result.last_update ? new Date(result.last_update) : null;
    } catch (error) {
      console.error("Error fetching last update time:", error);
      throw new InternalServerErrorException("Error fetching last update time");
    }
  }

  async findIrrigationInterval() {
    try {
      const allSectors = Object.keys(this.sectorMap);

      const activeSectorsQuery = `
        WITH ultimos AS (
          SELECT m1.mt_name, m1.mt_value, m1.mt_time_2
          FROM parc_18_zagal m1
          JOIN (
              SELECT mt_name, MAX(mt_time_2) AS max_time
              FROM parc_18_zagal
              WHERE mt_name LIKE '%sector%'
              GROUP BY mt_name
          ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time
        )
        SELECT mt_name, mt_value, mt_time_2
        FROM ultimos
        WHERE mt_value = 1;
      `;
      const [activeRows] = await this.dbConfig.pool.query(activeSectorsQuery);
      const activeSectors = (activeRows as any[]).map((r) => r.mt_name);
      const activeCount = activeSectors.length;

      let irrigationTimes: Record<string, any> = {};
      if (activeCount > 0) {
        const placeholders = activeSectors.map(() => "?").join(",");
        const irrigationTimeQuery = `
          SELECT p.mt_name,
                 TIMESTAMPDIFF(SECOND, MAX(p2.mt_time_2), MAX(p.mt_time_2)) AS tiempo_riego_segundos,
                 MAX(p2.mt_time_2) AS start_time,
                 MAX(p.mt_time_2) AS last_time
          FROM parc_18_zagal p
          JOIN (
              SELECT mt_name, MAX(mt_time_2) AS mt_time_2
              FROM parc_18_zagal
              WHERE mt_name LIKE '%sector%' AND mt_value = 0
              GROUP BY mt_name
          ) p2 ON p.mt_name = p2.mt_name
          WHERE p.mt_name IN (${placeholders})
          GROUP BY p.mt_name;
        `;
        const [timeRows] = await this.dbConfig.pool.query(
          irrigationTimeQuery,
          activeSectors
        );
        irrigationTimes = Object.fromEntries(
          (timeRows as any[]).map((r) => [r.mt_name, r])
        );
      }

      let totalizadorGlobal = 0;
      let startTimeGlobal: string | null = null;
      let endTimeGlobal: string | null = null;

      if (activeCount > 0) {
        const startTimes = Object.values(irrigationTimes)
          .map((r: any) => r.start_time)
          .filter(Boolean)
          .sort();
        const endTimes = Object.values(irrigationTimes)
          .map((r: any) => r.last_time)
          .filter(Boolean)
          .sort();

        if (startTimes.length > 0 && endTimes.length > 0) {
          startTimeGlobal = startTimes[0];
          endTimeGlobal = endTimes[endTimes.length - 1];

          const totalQuery = `
            SELECT COALESCE(
              (SELECT MAX(mt_value) - MIN(mt_value)
               FROM parc_18_zagal
               WHERE mt_name = 'PARC_18_ZAGAL--slave.totalizador'
                 AND mt_time_2 BETWEEN ? AND ?),
              0
            ) AS totalizador;
          `;
          const [totalRows] = await this.dbConfig.pool.query(totalQuery, [
            startTimeGlobal,
            endTimeGlobal,
          ]);
          const totRow = (totalRows as any[])[0];
          totalizadorGlobal = totRow ? Number(totRow.totalizador) || 0 : 0;
        }
      }

      const totalizadorPorSector =
        activeCount > 0 ? totalizadorGlobal / activeCount : 0;

      const results = [];
      for (const mt_name of allSectors) {
        const alias = this.sectorMap[mt_name];
        const active = activeSectors.includes(mt_name);
        const sectorData = irrigationTimes[mt_name] || {};

        results.push({
          mt_name: alias,
          is_active: active ? 1 : 0,
          tiempo_riego_segundos: active
            ? sectorData.tiempo_riego_segundos || 0
            : 0,
          totalizador: active ? totalizadorPorSector : 0,
        });
      }

      return results;
    } catch (error) {
      console.error("Error fetching irrigation interval:", error);
      throw new InternalServerErrorException(
        "Error fetching irrigation interval"
      );
    }
  }

  async activeSectors(): Promise<{ mt_name: string; is_active: number }[]> {
    try {
      const query = `
          SELECT m1.mt_name, m1.mt_value
          FROM parc_18_zagal m1
          JOIN (
              SELECT mt_name, MAX(mt_time_2) as max_time
              FROM parc_18_zagal
              WHERE mt_name LIKE '%sector%'
              GROUP BY mt_name
          ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time;
        `;

      const [rows] = await this.dbConfig.pool.query(query);
      const dbRows = rows as Metric[];

      const statusMap: Record<string, number> = {};
      dbRows.forEach((row) => {
        statusMap[row.mt_name] = Number(row.mt_value);
      });

      const results = Object.keys(this.sectorMap).map((key) => {
        const isActive = statusMap[key] === 1 ? 1 : 0;
        return {
          mt_name: this.sectorMap[key],
          is_active: isActive,
        };
      });

      return results;
    } catch (error) {
      console.error("Error fetching active sectors:", error);
      throw new InternalServerErrorException("Error fetching active sectors");
    }
  }

  async getDailyIrrigationSummary(
    startDate: string,
    endDate: string
  ): Promise<
    {
      mt_name: string;
      date: string;
      value: number;
      totalizador: number;
      caudal: number;
    }[]
  > {
    try {
      const [rows] = await this.dbConfig.pool.query(
        `
      WITH ordered AS (
          SELECT 
              mt_name,
              mt_value,
              mt_time_2,
              LAG(mt_value) OVER (PARTITION BY mt_name ORDER BY mt_time_2) AS prev_value,
              LAG(mt_time_2) OVER (PARTITION BY mt_name ORDER BY mt_time_2) AS prev_time
          FROM parc_18_zagal
          WHERE mt_name IN (
              'PARC_18_ZAGAL--slave.sector1',
              'PARC_18_ZAGAL--slave.sector2',
              'PARC_18_ZAGAL--slave.sector3',
              'PARC_18_ZAGAL--slave.sector4',
              'PARC_18_ZAGAL--slave.sector5'
          )
            AND mt_time_2 >= ?
            AND mt_time_2 < DATE_ADD(?, INTERVAL 1 DAY)
      ),
      intervalos AS (
          SELECT 
              o.mt_name,
              DATE(o.mt_time_2) AS date,
              MIN(o.mt_time_2) AS inicio,
              MAX(o.mt_time_2) AS fin,
              SUM(
                CASE 
                  WHEN o.prev_value = 1 AND o.mt_value = 1 
                  THEN TIMESTAMPDIFF(SECOND, o.prev_time, o.mt_time_2)
                  ELSE 0
                END
              ) AS tiempo_riego
          FROM ordered o
          WHERE o.mt_value = 1
          GROUP BY o.mt_name, DATE(o.mt_time_2)
      ),

      totalizador_series AS (
          SELECT
              mt_time_2,
              mt_value AS totalizador_value,
              LAG(mt_value) OVER (ORDER BY mt_time_2) AS prev_totalizador,
              LAG(mt_time_2) OVER (ORDER BY mt_time_2) AS prev_time
          FROM parc_18_zagal
          WHERE mt_name = 'PARC_18_ZAGAL--slave.totalizador'
            AND mt_time_2 BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      ),

      totalizador_increments AS (
          SELECT
              mt_time_2,
              prev_time,
              (totalizador_value - prev_totalizador) AS delta_totalizador
          FROM totalizador_series
          WHERE prev_totalizador IS NOT NULL
            AND (totalizador_value - prev_totalizador) >= 0  -- evita reinicios negativos
      ),

      active_count AS (
          SELECT
              t.mt_time_2,
              COUNT(DISTINCT s.mt_name) AS n_activos
          FROM totalizador_increments t
          JOIN intervalos s
            ON t.mt_time_2 BETWEEN s.inicio AND s.fin
          GROUP BY t.mt_time_2
      ),

      weighted_totalizer AS (
          SELECT
              t.mt_time_2,
              t.prev_time,
              t.delta_totalizador,
              COALESCE(a.n_activos, 1) AS n_activos,
              t.delta_totalizador / COALESCE(a.n_activos, 1) AS delta_por_sector
          FROM totalizador_increments t
          LEFT JOIN active_count a USING (mt_time_2)
      ),

      totalizador_calc AS (
          SELECT
              s.mt_name,
              s.date,
              SUM(w.delta_por_sector) AS totalizador
          FROM intervalos s
          JOIN weighted_totalizer w
            ON w.mt_time_2 BETWEEN s.inicio AND s.fin
          GROUP BY s.mt_name, s.date
      ),

      caudal_calc AS (
          SELECT 
              i.mt_name,
              i.date,
              COALESCE(
                (
                  SELECT AVG(c.mt_value)
                  FROM parc_18_zagal c
                  WHERE c.mt_name = 'PARC_18_ZAGAL--slave.caudal'
                    AND c.mt_time_2 BETWEEN i.inicio AND i.fin
                ), 0
              ) AS caudal
          FROM intervalos i
      )

      SELECT 
          i.mt_name,
          i.date,
          i.tiempo_riego AS value,
          COALESCE(tc.totalizador, 0) AS totalizador,
          COALESCE(cc.caudal, 0) AS caudal
      FROM intervalos i
      LEFT JOIN totalizador_calc tc
        ON i.mt_name = tc.mt_name AND i.date = tc.date
      LEFT JOIN caudal_calc cc
        ON i.mt_name = cc.mt_name AND i.date = cc.date
      ORDER BY i.mt_name, i.date;
      `,
        [startDate, endDate, startDate, endDate]
      );

      return (rows as any[]).map((r) => ({
        mt_name: this.mapParcela(r.mt_name),
        date: r.date,
        value: Number(r.value),
        totalizador: Number(r.totalizador),
        caudal: Number(r.caudal),
      }));
    } catch (error) {
      console.error("Error fetching irrigation summary:", error);
      throw new InternalServerErrorException(
        "Error fetching irrigation summary"
      );
    }
  }
}
