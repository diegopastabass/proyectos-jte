// metrics.service.ts
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { DatabaseConfig } from "../config/database.config";
import { CreateMetricDto } from "../models/create-metric.dto";
import { Metric } from "../models/metric.interface";
import { RiegoResponse } from "src/models/data.interface";

@Injectable()
export class MetricsService {
  constructor(private readonly dbConfig: DatabaseConfig) {}

  async findLatest(limit: number): Promise<Metric[]> {
    try {
      const sensorName = "PARC_57_ZAGAL--slave.caudal";
      const [rows] = await this.dbConfig.pool.query(
        "SELECT mt_value FROM ssr_zagal WHERE mt_name = ? ORDER BY mt_time_2 DESC LIMIT ?",
        [sensorName, limit]
      );
      return rows as Metric[];
    } catch (error) {
      throw new InternalServerErrorException("Error fetching latest metrics");
    }
  }

  async findLatestByName(name: string): Promise<Metric | null> {
    try {
      const [rows] = await this.dbConfig.pool.query(
        "SELECT mt_id, mt_name, mt_value, mt_time_2 FROM ssr_zagal WHERE mt_name = ? ORDER BY mt_time_2 DESC LIMIT 1",
        [name]
      );
      const metrics = rows as Metric[];
      return metrics.length > 0 ? metrics[0] : null;
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
         FROM ssr_zagal m1
         JOIN (
             SELECT mt_name, MAX(mt_time_2) AS max_time
             FROM ssr_zagal
             GROUP BY mt_name
         ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time;`
      );

      const result: { [key: string]: number } = {};
      (rows as Metric[]).forEach((row: Metric) => {
        result[row.mt_name] = row.mt_value;
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
        "SELECT MAX(mt_time_2) AS last_update FROM ssr_zagal"
      );
      const result = (rows as { last_update: string | null }[])[0];
      return result && result.last_update ? new Date(result.last_update) : null;
    } catch (error) {
      console.error("Error fetching last update time:", error);
      throw new InternalServerErrorException("Error fetching last update time");
    }
  }

  async findIrrigationInterval(): Promise<RiegoResponse[] | null> {
    try {
      const sql = `
      WITH ultima_fecha AS (
          SELECT MAX(mt_time_2) AS max_time
          FROM ssr_zagal
          WHERE mt_name = ?
      ),
      datos AS (
          SELECT 
              mt_time_2,
              mt_value,
              LAG(mt_value) OVER (ORDER BY mt_time_2) AS prev_value
          FROM ssr_zagal, ultima_fecha
          WHERE mt_name = ?
            AND mt_time_2 BETWEEN DATE_SUB(ultima_fecha.max_time, INTERVAL 30 DAY) 
                             AND ultima_fecha.max_time
      ),
      intervalos AS (
          SELECT 
              i.tiempo_inicio,
              f.tiempo_fin
          FROM (
              SELECT mt_time_2 AS tiempo_inicio
              FROM datos
              WHERE mt_value > 0 AND (prev_value = 0 OR prev_value IS NULL)
          ) i
          JOIN (
              SELECT mt_time_2 AS tiempo_fin
              FROM datos
              WHERE mt_value = 0 AND prev_value > 0
          ) f 
            ON f.tiempo_fin > i.tiempo_inicio
            AND f.tiempo_fin = (
                  SELECT MIN(f2.mt_time_2)
                  FROM (
                      SELECT mt_time_2
                      FROM datos
                      WHERE mt_value = 0 AND prev_value > 0
                  ) f2
                  WHERE f2.mt_time_2 > i.tiempo_inicio
               )
      )
      SELECT 
          i.tiempo_inicio,
          i.tiempo_fin,
          TIMESTAMPDIFF(SECOND, i.tiempo_inicio, i.tiempo_fin) AS tiempo_riego_segundos,
          ROUND(AVG(c.mt_value), 2) AS caudal_promedio,
          (
              (
                  SELECT t.mt_value
                  FROM ssr_zagal t
                  WHERE t.mt_name = 'PARC_57_ZAGAL--slave.totalizador'
                    AND t.mt_time_2 >= i.tiempo_fin
                  ORDER BY t.mt_time_2 ASC
                  LIMIT 1
              )
              -
              (
                  SELECT t.mt_value
                  FROM ssr_zagal t
                  WHERE t.mt_name = 'PARC_57_ZAGAL--slave.totalizador'
                    AND t.mt_time_2 >= i.tiempo_inicio
                  ORDER BY t.mt_time_2 ASC
                  LIMIT 1
              )
          ) AS volumen
      FROM intervalos i
      JOIN ssr_zagal c
        ON c.mt_name = ?
       AND c.mt_time_2 BETWEEN i.tiempo_inicio AND i.tiempo_fin
      GROUP BY i.tiempo_inicio, i.tiempo_fin
      ORDER BY i.tiempo_inicio DESC;
    `;

      const sensorName = "PARC_57_ZAGAL--slave.caudal";

      const [rows] = await this.dbConfig.pool.query(sql, [
        sensorName,
        sensorName,
        sensorName,
      ]);

      return rows as RiegoResponse[];
    } catch (error) {
      console.error("Error fetching Irrigation Interval: ", error);
      throw new InternalServerErrorException(
        "Error fetching Irrigation Interval"
      );
    }
  }

  async getIrrigationTimeByRange(
    startDate: string,
    endDate: string
  ): Promise<{ mt_name: string; date: string; value: number }[]> {
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
          FROM ssr_zagal
          WHERE mt_name IN (
            'PARC_57_ZAGAL--slave.sector1',
            'PARC_57_ZAGAL--slave.sector2',
            'PARC_57_ZAGAL--slave.sector3',
            'PARC_57_ZAGAL--slave.sector4'
          )
            AND mt_time_2 >= ? 
            AND mt_time_2 < DATE_ADD(?, INTERVAL 1 DAY)
        )
        SELECT 
            mt_name,
            DATE(mt_time_2) AS date,
            SUM(
              CASE 
                WHEN prev_value = 1 AND mt_value = 1 
                THEN TIMESTAMPDIFF(SECOND, prev_time, mt_time_2)
                ELSE 0
              END
            ) AS value
        FROM ordered
        WHERE mt_value = 1
        GROUP BY mt_name, DATE(mt_time_2)
        ORDER BY mt_name, date
        `,
        [startDate, endDate]
      );

      return (rows as any[]).map((r) => ({
        mt_name: r.mt_name,
        date: r.date,
        value: Number(r.value),
      }));
    } catch (error) {
      console.error("Error fetching irrigation time by range:", error);
      throw new InternalServerErrorException(
        "Error fetching irrigation time by range"
      );
    }
  }
}
