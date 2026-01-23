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
var MetricsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = exports.Total = exports.Metric = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let Metric = class Metric {
    mt_id;
    mt_name;
    mt_value;
    mt_time_2;
};
exports.Metric = Metric;
__decorate([
    (0, typeorm_2.Column)({ name: 'mt_id' }),
    __metadata("design:type", Number)
], Metric.prototype, "mt_id", void 0);
__decorate([
    (0, typeorm_2.Column)({ name: 'mt_name' }),
    __metadata("design:type", String)
], Metric.prototype, "mt_name", void 0);
__decorate([
    (0, typeorm_2.Column)({ name: 'mt_value' }),
    __metadata("design:type", Number)
], Metric.prototype, "mt_value", void 0);
__decorate([
    (0, typeorm_2.Column)({ name: 'mt_time_2' }),
    __metadata("design:type", Date)
], Metric.prototype, "mt_time_2", void 0);
exports.Metric = Metric = __decorate([
    (0, typeorm_2.ViewEntity)({
        name: 'ssr_bucalemu',
        expression: `SELECT * FROM ssr_bucalemu`,
    })
], Metric);
class Total {
    time;
    value;
}
exports.Total = Total;
let MetricsService = MetricsService_1 = class MetricsService {
    metricRepository;
    logger = new common_1.Logger(MetricsService_1.name);
    metricsBuffer = [];
    flushInterval;
    constructor(metricRepository) {
        this.metricRepository = metricRepository;
    }
    onModuleInit() {
        this.flushInterval = setInterval(() => {
            this.flushMetrics();
        }, 30000);
    }
    onModuleDestroy() {
        clearInterval(this.flushInterval);
        this.flushMetrics();
    }
    async createMetric(dto) {
        this.metricsBuffer.push(dto);
        if (this.metricsBuffer.length >= 100) {
            await this.flushMetrics();
        }
        return { success: true, message: 'Metric buffered' };
    }
    async flushMetrics() {
        if (this.metricsBuffer.length === 0)
            return;
        const dataToSave = [...this.metricsBuffer];
        this.metricsBuffer = [];
        try {
            await this.metricRepository
                .createQueryBuilder()
                .insert()
                .into(Metric)
                .values(dataToSave)
                .execute();
            this.logger.log(`Bulk inserted ${dataToSave.length} metrics`);
        }
        catch (error) {
            this.logger.error('Error in bulk insert', error);
        }
    }
    async findLatestMetrics(limit) {
        return this.metricRepository.find({
            order: { mt_time_2: 'DESC' },
            take: limit,
        });
    }
    async findLatestMetricByName(name) {
        return this.metricRepository.findOne({
            where: { mt_name: name },
            order: { mt_time_2: 'DESC' },
        });
    }
    async findLatestForEachName() {
        const metrics = await this.metricRepository
            .createQueryBuilder('metric')
            .distinctOn(['metric.mt_name'])
            .orderBy('metric.mt_name')
            .addOrderBy('metric.mt_time_2', 'DESC')
            .getMany();
        const result = {};
        metrics.forEach((metric) => {
            let finalName = metric.mt_name;
            let finalValue = Number(metric.mt_value);
            if (metric.mt_name === 'CASUTO--slave.AI12') {
                finalName = 'ssr_casuto_nivel';
                finalValue = finalValue / 100;
            }
            else if (metric.mt_name === 'CASUTO--slave.AI32') {
                finalName = 'ssr_casuto_bateria';
            }
            result[finalName] = {
                value: finalValue,
                time: metric.mt_time_2,
            };
        });
        return result;
    }
    async findLastUpdateTime() {
        const result = await this.metricRepository
            .createQueryBuilder('metric')
            .select('MAX(metric.mt_time_2)', 'lastUpdateTime')
            .getRawOne();
        return result?.lastUpdateTime ?? null;
    }
    async findAllMeasurements() {
        const rawQuery = `
      SELECT subquery.*
      FROM (
        SELECT
          *,
          ROW_NUMBER() OVER (PARTITION BY "mt_name" ORDER BY "mt_time_2" DESC) as rn
        FROM "ssr_bucalemu"
      ) as subquery
      WHERE subquery.rn <= 100
      AND (subquery."mt_name" LIKE '%nivel' OR subquery."mt_name" = 'CASUTO--slave.AI12')
      ORDER BY subquery."mt_name", subquery.rn DESC;
    `;
        const rows = (await this.metricRepository.query(rawQuery));
        const grouped = {};
        rows.forEach((row) => {
            let name = row.mt_name;
            let value = Number(row.mt_value);
            if (name === 'CASUTO--slave.AI12') {
                name = 'ssr_casuto_nivel';
                value = value / 100;
            }
            if (!grouped[name]) {
                grouped[name] = [];
            }
            grouped[name].push({
                mt_value: value,
                mt_time_2: new Date(row.mt_time_2),
            });
        });
        return grouped;
    }
    async estimateEmptyingTimes() {
        try {
            const rawQuery = `
      SELECT *
      FROM (
        SELECT 
          "mt_name",
          "mt_value",
          "mt_time_2",
          ROW_NUMBER() OVER (PARTITION BY "mt_name" ORDER BY "mt_time_2" DESC) AS rn
        FROM "ssr_bucalemu"
        WHERE "mt_name" LIKE '%nivel' OR "mt_name" = 'CASUTO--slave.AI12'
      ) t
      WHERE t.rn <= 2
      ORDER BY t."mt_name", t.rn;
    `;
            const rows = (await this.metricRepository.query(rawQuery));
            const grouped = {};
            rows.forEach((row) => {
                let value = Number(row.mt_value);
                if (row.mt_name === 'CASUTO--slave.AI12') {
                    value = value / 100;
                }
                if (!grouped[row.mt_name])
                    grouped[row.mt_name] = [];
                grouped[row.mt_name].push({
                    value: value,
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
                let key;
                if (name === 'CASUTO--slave.AI12') {
                    key = 't_vaciado_casuto_nivel';
                }
                else {
                    key = `t_vaciado_${name.replace(/^ssr_/, '')}`;
                }
                result[key] = isNaN(segundos)
                    ? 'NaN'
                    : this.formatSecondsToDuration(Math.round(segundos));
            }
            return result;
        }
        catch (error) {
            this.logger.error('Error estimating emptying times', error);
            throw new common_1.InternalServerErrorException('Error estimating emptying times');
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
    async getTotalizador(dto) {
        const { start, end } = dto;
        if (!start || !end)
            throw new Error('Se requiere rango de fechas válido.');
        const isoStart = start.toISOString().split('T')[0];
        const isoEnd = end.toISOString().split('T')[0];
        const queryStart = `${isoStart} 00:00:00`;
        const queryEnd = `${isoEnd} 23:59:59`;
        const results = await this.metricRepository.query(`
        WITH bounds AS (
          SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_bucalemu
          WHERE mt_name = 'ssr_nilahue_totalizador'
          AND mt_time_2 BETWEEN $1 AND $2
          GROUP BY mt_time_2::DATE
        )
        SELECT b.day,
          (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_bucalemu s_first
          ON s_first.mt_name = 'ssr_nilahue_totalizador' AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_bucalemu s_last
          ON s_last.mt_name = 'ssr_nilahue_totalizador' AND s_last.mt_time_2 = b.last_ts
        GROUP BY b.day
        ORDER BY b.day ASC
      `, [queryStart, queryEnd]);
        return results.map((row) => ({
            time: typeof row.day === 'string'
                ? row.day
                : row.day.toISOString().split('T')[0],
            value: Number(row.daily_value),
        }));
    }
    formatDate(date) {
        const d = new Date(date);
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getDate())}-${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    async getCaudal(dto) {
        const { start, end } = dto || {};
        let results;
        if (!start || !end) {
            results = await this.metricRepository.find({
                where: { mt_name: 'ssr_nilahue_caudal' },
                order: { mt_time_2: 'DESC' },
                take: 100,
            });
            results.reverse();
        }
        else {
            results = await this.metricRepository.find({
                where: {
                    mt_name: 'ssr_nilahue_caudal',
                    mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start AND ${alias} < :end`, {
                        start,
                        end,
                    }),
                },
                order: { mt_time_2: 'ASC' },
            });
        }
        return results.map((row) => ({
            time: this.formatDate(row.mt_time_2),
            value: Number(row.mt_value),
        }));
    }
    formatSecondsToDuration(seconds) {
        if (seconds < 0)
            return 'NaN';
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        let result = '';
        if (days > 0)
            result += `${days}d `;
        if (hours > 0)
            result += `${hours}h `;
        if (minutes > 0)
            result += `${minutes}m `;
        if (secs > 0 || result === '')
            result += `${secs}s`;
        return result.trim();
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = MetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(Metric)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map