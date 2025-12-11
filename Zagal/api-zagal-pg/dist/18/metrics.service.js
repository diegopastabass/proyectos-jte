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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const parc18_entity_1 = require("./parc18.entity");
let MetricsService = class MetricsService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    sectorMap = {
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
    mapParcela(name) {
        return this.sectorMap[name] || name;
    }
    async findLatest() {
        try {
            const rows = await this.repo.query(`
        SELECT DISTINCT ON (mt_name) mt_name, mt_value
        FROM parc_18_zagal
        WHERE mt_name IN ('PARC_18_ZAGAL--slave.caudal', 'PARC_18_ZAGAL--slave.totalizador')
        ORDER BY mt_name, mt_time_2 DESC
      `);
            const result = { caudal: 0, totalizador: 0 };
            for (const row of rows) {
                const value = Number(row.mt_value);
                if (row.mt_name.includes('caudal'))
                    result.caudal = value;
                if (row.mt_name.includes('totalizador'))
                    result.totalizador = value / 10;
            }
            return result;
        }
        catch (error) {
            console.error("Error fetching latest metrics:", error);
            throw new common_1.InternalServerErrorException("Error fetching latest metrics");
        }
    }
    async activeSectors() {
        try {
            const rows = await this.repo.query(`
        SELECT DISTINCT ON (mt_name) mt_name, mt_value
        FROM parc_18_zagal
        WHERE mt_name LIKE '%sector%'
        ORDER BY mt_name, mt_time_2 DESC
      `);
            const statusMap = {};
            rows.forEach((row) => {
                statusMap[row.mt_name] = row.mt_value === '1' ? 1 : 0;
            });
            return Object.keys(this.sectorMap).map((key) => ({
                mt_name: this.sectorMap[key],
                is_active: statusMap[key] || 0,
            }));
        }
        catch (error) {
            console.error("Error fetching active sectors:", error);
            throw new common_1.InternalServerErrorException("Error fetching active sectors");
        }
    }
    async findLatestByName(name) {
        try {
            const metric = await this.repo.findOne({
                where: { mt_name: name },
                order: { mt_time_2: 'DESC' },
            });
            if (metric)
                metric.mt_name = this.mapParcela(metric.mt_name);
            return metric;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException("Error fetching latest metric by name");
        }
    }
    async findLatestForEachName() {
        try {
            const rows = await this.repo.query(`
        SELECT DISTINCT ON (mt_name) mt_name, mt_value
        FROM parc_18_zagal
        ORDER BY mt_name, mt_time_2 DESC
      `);
            const result = {};
            rows.forEach((row) => {
                result[this.mapParcela(row.mt_name)] = Number(row.mt_value);
            });
            return result;
        }
        catch (error) {
            console.error("Error fetching latest metrics for all:", error);
            throw new common_1.InternalServerErrorException("Error fetching metrics");
        }
    }
    async findLastUpdateTime() {
        try {
            const result = await this.repo.createQueryBuilder('p')
                .select('MAX(p.mt_time_2)', 'max')
                .getRawOne();
            return result ? result.max : null;
        }
        catch (error) {
            console.error("Error fetching last update:", error);
            throw new common_1.InternalServerErrorException("Error fetching last update");
        }
    }
    async findIrrigationInterval() {
        try {
            const activeRows = await this.repo.query(`
        SELECT DISTINCT ON (mt_name) mt_name, mt_value
        FROM parc_18_zagal
        WHERE mt_name LIKE '%sector%'
        ORDER BY mt_name, mt_time_2 DESC
      `);
            const activeSectors = activeRows
                .filter(r => r.mt_value === '1')
                .map(r => r.mt_name);
            const activeCount = activeSectors.length;
            let irrigationTimes = {};
            if (activeCount > 0) {
                const placeholders = activeSectors.map((_, i) => `$${i + 1}`).join(",");
                const irrigationTimeQuery = `
          SELECT p.mt_name,
                 EXTRACT(EPOCH FROM (MAX(p.mt_time_2) - MAX(p2.mt_time_2))) AS tiempo_riego_segundos,
                 MAX(p2.mt_time_2) AS start_time,
                 MAX(p.mt_time_2) AS last_time
          FROM parc_18_zagal p
          JOIN (
              SELECT mt_name, MAX(mt_time_2) AS mt_time_2
              FROM parc_18_zagal
              WHERE mt_name LIKE '%sector%' AND mt_value = '0'
              GROUP BY mt_name
          ) p2 ON p.mt_name = p2.mt_name
          WHERE p.mt_name IN (${placeholders})
          GROUP BY p.mt_name
        `;
                const timeRows = await this.repo.query(irrigationTimeQuery, activeSectors);
                irrigationTimes = Object.fromEntries(timeRows.map((r) => [r.mt_name, r]));
            }
            let totalizadorPorSector = 0;
            if (activeCount > 0) {
                const startTimes = Object.values(irrigationTimes).map((r) => new Date(r.start_time).getTime());
                const endTimes = Object.values(irrigationTimes).map((r) => new Date(r.last_time).getTime());
                if (startTimes.length && endTimes.length) {
                    const minStart = new Date(Math.min(...startTimes));
                    const maxEnd = new Date(Math.max(...endTimes));
                    const totalRow = await this.repo.query(`
                SELECT COALESCE(MAX(mt_value::numeric) - MIN(mt_value::numeric), 0) as total
                FROM parc_18_zagal
                WHERE mt_name = 'PARC_18_ZAGAL--slave.totalizador'
                AND mt_time_2 BETWEEN $1 AND $2
              `, [minStart, maxEnd]);
                    const totalGlobal = totalRow[0] ? Number(totalRow[0].total) : 0;
                    totalizadorPorSector = totalGlobal / activeCount;
                }
            }
            const allSectors = Object.keys(this.sectorMap);
            return allSectors.map(mt_name => {
                const active = activeSectors.includes(mt_name);
                const data = irrigationTimes[mt_name];
                return {
                    mt_name: this.sectorMap[mt_name],
                    is_active: active ? 1 : 0,
                    tiempo_riego_segundos: active ? Number(data?.tiempo_riego_segundos || 0) : 0,
                    totalizador: active ? totalizadorPorSector : 0
                };
            });
        }
        catch (error) {
            console.error("Error fetching irrigation interval:", error);
            throw new common_1.InternalServerErrorException("Error fetching irrigation interval");
        }
    }
    async getDailyIrrigationSummary(startDate, endDate) {
        try {
            const query = `
      WITH ordered AS (
          SELECT 
              mt_name, mt_value, mt_time_2,
              LAG(mt_value) OVER (PARTITION BY mt_name ORDER BY mt_time_2) AS prev_value,
              LAG(mt_time_2) OVER (PARTITION BY mt_name ORDER BY mt_time_2) AS prev_time
          FROM parc_18_zagal
          WHERE mt_name LIKE '%sector%'
            AND mt_time_2 >= $1::timestamp
            AND mt_time_2 < $2::timestamp + INTERVAL '1 day'
      ),
      intervalos AS (
          SELECT 
              o.mt_name,
              o.mt_time_2::date AS date,
              MIN(o.mt_time_2) AS inicio,
              MAX(o.mt_time_2) AS fin,
              SUM(
                CASE 
                  WHEN o.prev_value = '1' AND o.mt_value = '1' 
                  THEN EXTRACT(EPOCH FROM (o.mt_time_2 - o.prev_time))
                  ELSE 0
                END
              ) AS tiempo_riego
          FROM ordered o
          WHERE o.mt_value = '1'
          GROUP BY o.mt_name, o.mt_time_2::date
      ),
      totalizador_series AS (
          SELECT
              mt_time_2,
              NULLIF(mt_value, '')::numeric AS totalizador_value,
              LAG(NULLIF(mt_value, '')::numeric) OVER (ORDER BY mt_time_2) AS prev_totalizador
          FROM parc_18_zagal
          WHERE mt_name = 'PARC_18_ZAGAL--slave.totalizador'
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
          FROM parc_18_zagal c 
          WHERE c.mt_name = 'PARC_18_ZAGAL--slave.caudal' AND c.mt_time_2 BETWEEN i.inicio AND i.fin
         ) as caudal
         FROM intervalos i
      )
      SELECT 
          i.mt_name, i.date, i.tiempo_riego AS value,
          COALESCE(fc.totalizador, 0) AS totalizador,
          COALESCE(ca.caudal, 0) AS caudal
      FROM intervalos i
      LEFT JOIN final_calc fc ON i.mt_name = fc.mt_name AND i.date = fc.date
      LEFT JOIN caudal_avg ca ON i.mt_name = ca.mt_name AND i.date = ca.date
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
    __param(0, (0, typeorm_1.InjectRepository)(parc18_entity_1.Parc18Zagal)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map