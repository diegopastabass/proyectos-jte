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
const database_config_1 = require("../config/database.config");
let MetricsService = class MetricsService {
    dbConfig;
    constructor(dbConfig) {
        this.dbConfig = dbConfig;
    }
    async create(dto) {
        try {
            const [result] = await this.dbConfig.pool.execute("INSERT INTO ssr_bucalemu (mt_name, mt_value) VALUES (?, ?)", [dto.mt_name, dto.mt_value]);
            return result.insertId;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException("Error creating metric");
        }
    }
    async findLatest(limit) {
        try {
            const [rows] = await this.dbConfig.pool.query("SELECT mt_id, mt_name, mt_value, mt_time_2 FROM ssr_bucalemu ORDER BY mt_time_2 DESC LIMIT ?", [limit]);
            return rows;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException("Error fetching latest metrics");
        }
    }
    async findLatestByName(name) {
        try {
            const [rows] = await this.dbConfig.pool.query("SELECT mt_value FROM ssr_bucalemu WHERE mt_name = ? ORDER BY mt_time_2 DESC LIMIT 1", [name]);
            const metrics = rows;
            return metrics.length > 0 ? metrics[0] : null;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException("Error fetching latest metric by name");
        }
    }
    async findLatestForEachName() {
        try {
            const [rows] = await this.dbConfig.pool.query(`SELECT m1.mt_name, m1.mt_value, m1.mt_time_2
       FROM ssr_bucalemu m1
       JOIN (
           SELECT mt_name, MAX(mt_time_2) AS max_time
           FROM ssr_bucalemu
           GROUP BY mt_name
       ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time;`);
            const result = {};
            rows.forEach((row) => {
                result[row.mt_name] = {
                    value: row.mt_value,
                    time: new Date(row.mt_time_2).toISOString(),
                };
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
            const [rows] = await this.dbConfig.pool.query("SELECT MAX(mt_time_2) AS last_update FROM ssr_bucalemu");
            const result = rows[0];
            return result && result.last_update ? new Date(result.last_update) : null;
        }
        catch (error) {
            console.error("Error fetching last update time:", error);
            throw new common_1.InternalServerErrorException("Error fetching last update time");
        }
    }
    async estimateEmptyingTimes() {
        try {
            const [rows] = await this.dbConfig.pool.query(`SELECT t.mt_name, t.mt_value, t.mt_time_2
       FROM (
         SELECT 
           mt_name,
           mt_value,
           mt_time_2,
           ROW_NUMBER() OVER (PARTITION BY mt_name ORDER BY mt_time_2 DESC) AS rn
         FROM ssr_bucalemu
         WHERE mt_name LIKE '%nivel'
       ) t
       WHERE t.rn <= 2
       ORDER BY t.mt_name, t.rn`);
            const grouped = {};
            rows.forEach((row) => {
                if (!grouped[row.mt_name])
                    grouped[row.mt_name] = [];
                grouped[row.mt_name].push({
                    value: row.mt_value,
                    time: new Date(row.mt_time_2).toISOString(),
                });
            });
            const result = {};
            for (const name in grouped) {
                const datos = grouped[name];
                if (datos.length < 2)
                    continue;
                const nivel1 = datos[0].value;
                const timestamp1 = datos[0].time;
                const nivel2 = datos[1].value;
                const timestamp2 = datos[1].time;
                const segundos = this.estimateEmptyingTime(nivel1, timestamp1, nivel2, timestamp2);
                const key = `t_vaciado_${name.replace(/^ssr_/, "")}`;
                result[key] = isNaN(segundos)
                    ? "NaN"
                    : this.formatSecondsToDuration(Math.round(segundos));
            }
            return result;
        }
        catch (error) {
            console.error("Error estimating emptying times:", error);
            throw new common_1.InternalServerErrorException("Error estimating emptying times");
        }
    }
    estimateEmptyingTime(level1, timestamp1, level2, timestamp2) {
        if (isNaN(level1) || isNaN(level2)) {
            return NaN;
        }
        if (level1 >= level2) {
            return 0;
        }
        const date1 = new Date(timestamp1);
        const date2 = new Date(timestamp2);
        const deltaTimeSeconds = Math.abs((date2.getTime() - date1.getTime()) / 1000);
        if (deltaTimeSeconds === 0) {
            return NaN;
        }
        const lossRate = (level2 - level1) / deltaTimeSeconds;
        return level1 / lossRate;
    }
    formatSecondsToDuration(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        let result = "";
        if (days > 0)
            result += `${days}d `;
        if (hours > 0)
            result += `${hours}h `;
        if (minutes > 0)
            result += `${minutes}m `;
        if (secs > 0 || result === "")
            result += `${secs}s`;
        return result.trim();
    }
    async findAllMeasurements() {
        const now = new Date();
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        const query = `
    SELECT mt_name, mt_value, mt_time_2
    FROM measurements
    WHERE mt_time_2 >= ? AND mt_name LIKE ?
    ORDER BY mt_time_2 ASC
  `;
        const [rows] = await this.dbConfig.pool.query(query, [
            sixHoursAgo,
            "%nivel%",
        ]);
        const grouped = {};
        for (const row of rows) {
            const { mt_name, mt_value, mt_time_2 } = row;
            if (!grouped[mt_name]) {
                grouped[mt_name] = [];
            }
            grouped[mt_name].push({
                mt_value: parseFloat(mt_value),
                mt_time_2: this.formatDate(mt_time_2),
            });
        }
        return grouped;
    }
    formatDate(date) {
        const pad = (n) => (n < 10 ? "0" + n : n);
        return (date.getFullYear() +
            "-" +
            pad(date.getMonth() + 1) +
            "-" +
            pad(date.getDate()) +
            " " +
            pad(date.getHours()) +
            ":" +
            pad(date.getMinutes()) +
            ":" +
            pad(date.getSeconds()));
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_config_1.DatabaseConfig])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map