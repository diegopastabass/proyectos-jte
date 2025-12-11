"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const database_config_1 = require("../../config/database.config");
let MetricsService = class MetricsService {
    dbConfig;
    constructor(dbConfig) {
        this.dbConfig = dbConfig;
    }
    async findLatest() {
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
            const metrics = rows;
            if (metrics.length === 0) {
                return { caudal: 0, totalizador: 0 };
            }
            const result = {
                caudal: 0,
                totalizador: 0,
            };
            for (const row of metrics) {
                const value = Number(row.mt_value);
                if (row.mt_name === "PARC_18_ZAGAL--slave.caudal") {
                    result.caudal = value;
                }
                else if (row.mt_name === "PARC_18_ZAGAL--slave.totalizador") {
                    result.totalizador = value / 10;
                }
            }
            return result;
        }
        catch (error) {
            console.error("Database Error:", error);
            throw new common_1.InternalServerErrorException("Error fetching latest metrics");
        }
    }
    async findLatestByName(name) {
        try {
            const [rows] = await this.dbConfig.pool.query("SELECT mt_id, mt_name, mt_value, mt_time_2 FROM parc_18_zagal WHERE mt_name = ? ORDER BY mt_time_2 DESC LIMIT 1", [name]);
            const metrics = rows;
            if (metrics.length > 0) {
                metrics[0].mt_name = metrics[0].mt_name;
                return metrics[0];
            }
            return null;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException("Error fetching latest metric by name");
        }
    }
    async findLatestForEachName() {
        try {
            const [rows] = await this.dbConfig.pool.query(`SELECT m1.mt_name, m1.mt_value
         FROM parc_18_zagal m1
         JOIN (
             SELECT mt_name, MAX(mt_time_2) AS max_time
             FROM parc_18_zagal
             GROUP BY mt_name
         ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time;`);
            const result = {};
            rows.forEach((row) => {
                const parcela = row.mt_name;
                result[parcela] = row.mt_value;
            });
            return result;
        }
        catch (error) {
            console.error("Error fetching latest metrics for all names:", error);
            throw new common_1.InternalServerErrorException("Error fetching latest metrics for all names");
        }
    }
    async findLastUpdateTime() {
        try {
            const [rows] = await this.dbConfig.pool.query("SELECT MAX(mt_time_2) AS last_update FROM parc_18_zagal");
            const result = rows[0];
            return result && result.last_update ? new Date(result.last_update) : null;
        }
        catch (error) {
            console.error("Error fetching last update time:", error);
            throw new common_1.InternalServerErrorException("Error fetching last update time");
        }
    }
    async findIrrigationInterval() {
        try {
            const sql = `
      WITH sectores AS (
        SELECT 'PARC_18_ZAGAL--slave.sector1' AS mt_name UNION ALL
        SELECT 'PARC_18_ZAGAL--slave.sector2' UNION ALL
        SELECT 'PARC_18_ZAGAL--slave.sector3' UNION ALL
        SELECT 'PARC_18_ZAGAL--slave.sector4' UNION ALL
        SELECT 'PARC_18_ZAGAL--slave.sector5'
      ),
      ultimas AS (
        SELECT mt_name, mt_value, mt_time_2
        FROM (
          SELECT mt_name, mt_value, mt_time_2,
                 ROW_NUMBER() OVER (PARTITION BY mt_name ORDER BY mt_time_2 DESC) AS rn
          FROM parc_18_zagal
          WHERE mt_name IN (
            'PARC_18_ZAGAL--slave.sector1',
            'PARC_18_ZAGAL--slave.sector2',
            'PARC_18_ZAGAL--slave.sector3',
            'PARC_18_ZAGAL--slave.sector4',
            'PARC_18_ZAGAL--slave.sector5'
          )
        ) t
        WHERE rn = 1
      ),
      ultimos_ceros AS (
        SELECT mt_name, MAX(mt_time_2) AS ultima_vez_cero
        FROM parc_18_zagal
        WHERE mt_name IN (
          'PARC_18_ZAGAL--slave.sector1',
          'PARC_18_ZAGAL--slave.sector2',
          'PARC_18_ZAGAL--slave.sector3',
          'PARC_18_ZAGAL--slave.sector4',
          'PARC_18_ZAGAL--slave.sector5'
        )
        AND mt_value = 0
        GROUP BY mt_name
      ),
      totalizador_actual AS (
        SELECT mt_time_2, mt_value
        FROM parc_18_zagal
        WHERE mt_name = 'PARC_18_ZAGAL--slave.totalizador'
      ),
      totalizador_cambio AS (
        SELECT t.mt_time_2, t.mt_value, c.mt_name AS sector_name
        FROM parc_18_zagal t
        JOIN ultimos_ceros c
          ON t.mt_time_2 >= c.ultima_vez_cero
        WHERE t.mt_name = 'PARC_18_ZAGAL--slave.totalizador'
      )
      SELECT 
        u.mt_name,
        CASE WHEN u.mt_value > 0 THEN 1 ELSE 0 END AS is_active,
        CASE 
          WHEN u.mt_value > 0 AND c.ultima_vez_cero IS NOT NULL
            THEN TIMESTAMPDIFF(SECOND, c.ultima_vez_cero, u.mt_time_2)
          ELSE 0
        END AS tiempo_riego_segundos,
        CASE
          WHEN u.mt_value > 0 THEN
            COALESCE(
              (SELECT t1.mt_value 
               FROM totalizador_actual t1
               WHERE t1.mt_time_2 <= u.mt_time_2
               ORDER BY t1.mt_time_2 DESC
               LIMIT 1), 0
            )
            -
            COALESCE(
              (SELECT t2.mt_value 
               FROM totalizador_cambio t2
               WHERE t2.sector_name = u.mt_name
               ORDER BY t2.mt_time_2 ASC
               LIMIT 1), 0
            )
          ELSE 0
        END AS totalizador
      FROM ultimas u
      LEFT JOIN ultimos_ceros c
        ON u.mt_name = c.mt_name
      ORDER BY u.mt_name;
    `;
            const [rows] = await this.dbConfig.pool.query(sql);
            return rows.map((r) => ({
                mt_name: r.mt_name,
                is_active: r.is_active,
                tiempo_riego_segundos: r.tiempo_riego_segundos,
                totalizador: r.totalizador,
            }));
        }
        catch (error) {
            console.error("Error fetching Irrigation Interval:", error);
            throw new common_1.InternalServerErrorException("Error fetching Irrigation Interval");
        }
    }
    async getDailyIrrigationSummary(startDate, endDate) {
        try {
            const [rows] = await this.dbConfig.pool.query(`
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
      totalizador_calc AS (
          SELECT 
              i.mt_name,
              i.date,
              COALESCE(
                (
                  SELECT MAX(t.mt_value) - MIN(t.mt_value)
                  FROM parc_18_zagal t
                  WHERE t.mt_name = 'PARC_18_ZAGAL--slave.totalizador'
                    AND t.mt_time_2 BETWEEN i.inicio AND i.fin
                ), 0
              ) AS totalizador
          FROM intervalos i
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
          SUM(tc.totalizador) AS totalizador,
          AVG(cc.caudal) AS caudal
      FROM intervalos i
      LEFT JOIN totalizador_calc tc
        ON i.mt_name = tc.mt_name AND i.date = tc.date
      LEFT JOIN caudal_calc cc
        ON i.mt_name = cc.mt_name AND i.date = cc.date
      GROUP BY i.mt_name, i.date, i.tiempo_riego
      ORDER BY i.mt_name, i.date;
      `, [startDate, endDate]);
            return rows.map((r) => ({
                mt_name: r.mt_name,
                date: r.date,
                value: Number(r.value),
                totalizador: Number(r.totalizador),
                caudal: Number(r.caudal),
            }));
        }
        catch (error) {
            console.error("Error fetching irrigation time by range:", error);
            throw new common_1.InternalServerErrorException("Error fetching irrigation time by range");
        }
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_config_1.DatabaseConfig])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map