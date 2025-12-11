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
    sectorMap = {
        "PARC_57_ZAGAL--slave.sector1": "NEC4",
        "PARC_57_ZAGAL--slave.sector2": "RICH LADY",
        "PARC_57_ZAGAL--slave.sector3": "303 NORTE",
        "PARC_57_ZAGAL--slave.sector4": "303 SUR",
        "PARC_57_ZAGAL--slave.sector5": "PARC 52",
        "PARC_57_ZAGAL--slave.sector6": "PARC 54 SUR",
        "PARC_57_ZAGAL--slave.sector7": "PARC 54 NORTE",
    };
    mapParcela(name) {
        return this.sectorMap[name] || name;
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
                  parc_57_zagal
              WHERE
                  mt_name IN ('PARC_57_ZAGAL--slave.caudal', 'PARC_57_ZAGAL--slave.totalizador')
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
                if (row.mt_name === "PARC_57_ZAGAL--slave.caudal") {
                    result.caudal = value;
                }
                else if (row.mt_name === "PARC_57_ZAGAL--slave.totalizador") {
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
            const [rows] = await this.dbConfig.pool.query("SELECT mt_id, mt_name, mt_value, mt_time_2 FROM parc_57_zagal WHERE mt_name = ? ORDER BY mt_time_2 DESC LIMIT 1", [name]);
            const metrics = rows;
            if (metrics.length > 0) {
                metrics[0].mt_name = this.mapParcela(metrics[0].mt_name);
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
         FROM parc_57_zagal m1
         JOIN (
             SELECT mt_name, MAX(mt_time_2) AS max_time
             FROM parc_57_zagal
             GROUP BY mt_name
         ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time;`);
            const result = {};
            rows.forEach((row) => {
                const parcela = this.mapParcela(row.mt_name);
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
            const [rows] = await this.dbConfig.pool.query("SELECT MAX(mt_time_2) AS last_update FROM parc_57_zagal");
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
            const sectorMap = {
                "PARC_57_ZAGAL--slave.sector1": "NEC4",
                "PARC_57_ZAGAL--slave.sector2": "RICH LADY",
                "PARC_57_ZAGAL--slave.sector3": "303 NORTE",
                "PARC_57_ZAGAL--slave.sector4": "303 SUR",
                "PARC_57_ZAGAL--slave.sector5": "PARC 52",
                "PARC_57_ZAGAL--slave.sector6": "PARC 54 SUR",
                "PARC_57_ZAGAL--slave.sector7": "PARC 54 NORTE",
            };
            const allSectors = Object.keys(sectorMap);
            const activeSectorsQuery = `
        WITH ultimos AS (
          SELECT m1.mt_name, m1.mt_value, m1.mt_time_2
          FROM parc_57_zagal m1
          JOIN (
              SELECT mt_name, MAX(mt_time_2) AS max_time
              FROM parc_57_zagal
              WHERE mt_name LIKE '%sector%'
              GROUP BY mt_name
          ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time
        )
        SELECT mt_name, mt_value, mt_time_2
        FROM ultimos
        WHERE mt_value = 1;
      `;
            const [activeRows] = await this.dbConfig.pool.query(activeSectorsQuery);
            const activeSectors = activeRows.map((r) => r.mt_name);
            const activeCount = activeSectors.length;
            let irrigationTimes = {};
            if (activeCount > 0) {
                const placeholders = activeSectors.map(() => "?").join(",");
                const irrigationTimeQuery = `
          SELECT p.mt_name,
                 TIMESTAMPDIFF(SECOND, MAX(p2.mt_time_2), MAX(p.mt_time_2)) AS tiempo_riego_segundos,
                 MAX(p2.mt_time_2) AS start_time,
                 MAX(p.mt_time_2) AS last_time
          FROM parc_57_zagal p
          JOIN (
              SELECT mt_name, MAX(mt_time_2) AS mt_time_2
              FROM parc_57_zagal
              WHERE mt_name LIKE '%sector%' AND mt_value = 0
              GROUP BY mt_name
          ) p2 ON p.mt_name = p2.mt_name
          WHERE p.mt_name IN (${placeholders})
          GROUP BY p.mt_name;
        `;
                const [timeRows] = await this.dbConfig.pool.query(irrigationTimeQuery, activeSectors);
                irrigationTimes = Object.fromEntries(timeRows.map((r) => [r.mt_name, r]));
            }
            let totalizadorGlobal = 0;
            let startTimeGlobal = null;
            let endTimeGlobal = null;
            if (activeCount > 0) {
                const startTimes = Object.values(irrigationTimes)
                    .map((r) => r.start_time)
                    .filter(Boolean)
                    .sort();
                const endTimes = Object.values(irrigationTimes)
                    .map((r) => r.last_time)
                    .filter(Boolean)
                    .sort();
                if (startTimes.length > 0 && endTimes.length > 0) {
                    startTimeGlobal = startTimes[0];
                    endTimeGlobal = endTimes[endTimes.length - 1];
                    const totalQuery = `
            SELECT COALESCE(
              (SELECT MAX(mt_value) - MIN(mt_value)
               FROM parc_57_zagal
               WHERE mt_name = 'PARC_57_ZAGAL--slave.totalizador'
                 AND mt_time_2 BETWEEN ? AND ?),
              0
            ) AS totalizador;
          `;
                    const [totalRows] = await this.dbConfig.pool.query(totalQuery, [
                        startTimeGlobal,
                        endTimeGlobal,
                    ]);
                    const totRow = totalRows[0];
                    totalizadorGlobal = totRow ? Number(totRow.totalizador) || 0 : 0;
                }
            }
            const totalizadorPorSector = activeCount > 0 ? totalizadorGlobal / activeCount : 0;
            const results = [];
            for (const mt_name of allSectors) {
                const alias = sectorMap[mt_name];
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
        }
        catch (error) {
            console.error("Error fetching irrigation interval:", error);
            throw new common_1.InternalServerErrorException("Error fetching irrigation interval");
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
          FROM parc_57_zagal
          WHERE mt_name IN (
              'PARC_57_ZAGAL--slave.sector1',
              'PARC_57_ZAGAL--slave.sector2',
              'PARC_57_ZAGAL--slave.sector3',
              'PARC_57_ZAGAL--slave.sector4',
              'PARC_57_ZAGAL--slave.sector5',
              'PARC_57_ZAGAL--slave.sector6',
              'PARC_57_ZAGAL--slave.sector7'
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

      -- Serie del totalizador
      totalizador_series AS (
          SELECT
              mt_time_2,
              mt_value AS totalizador_value,
              LAG(mt_value) OVER (ORDER BY mt_time_2) AS prev_totalizador,
              LAG(mt_time_2) OVER (ORDER BY mt_time_2) AS prev_time
          FROM parc_57_zagal
          WHERE mt_name = 'PARC_57_ZAGAL--slave.totalizador'
            AND mt_time_2 BETWEEN ? AND DATE_ADD(?, INTERVAL 1 DAY)
      ),

      -- Incrementos del totalizador (diferencias)
      totalizador_increments AS (
          SELECT
              mt_time_2,
              prev_time,
              (totalizador_value - prev_totalizador) AS delta_totalizador
          FROM totalizador_series
          WHERE prev_totalizador IS NOT NULL
            AND (totalizador_value - prev_totalizador) >= 0  -- evita reinicios negativos
      ),

      -- Cuántos sectores estaban activos en cada instante del totalizador
      active_count AS (
          SELECT
              t.mt_time_2,
              COUNT(DISTINCT s.mt_name) AS n_activos
          FROM totalizador_increments t
          JOIN intervalos s
            ON t.mt_time_2 BETWEEN s.inicio AND s.fin
          GROUP BY t.mt_time_2
      ),

      -- Totalizador ponderado por cantidad de sectores activos
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

      -- Totalizador acumulado por sector y día
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

      -- Cálculo promedio de caudal por sector
      caudal_calc AS (
          SELECT 
              i.mt_name,
              i.date,
              COALESCE(
                (
                  SELECT AVG(c.mt_value)
                  FROM parc_57_zagal c
                  WHERE c.mt_name = 'PARC_57_ZAGAL--slave.caudal'
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
      `, [startDate, endDate, startDate, endDate]);
            return rows.map((r) => ({
                mt_name: this.mapParcela(r.mt_name),
                date: r.date,
                value: Number(r.value),
                totalizador: Number(r.totalizador),
                caudal: Number(r.caudal),
            }));
        }
        catch (error) {
            console.error("Error fetching irrigation summary:", error);
            throw new common_1.InternalServerErrorException("Error fetching irrigation summary");
        }
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_config_1.DatabaseConfig])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map