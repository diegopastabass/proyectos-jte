"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MetricsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = exports.Total = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metric_entity_1 = require("../models/metric.entity");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class Total {
    time;
    value;
}
exports.Total = Total;
class MemoryCache {
    store = new Map();
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiry) {
            this.store.delete(key);
            return null;
        }
        return entry.data;
    }
    set(key, data, ttlMs) {
        this.store.set(key, { data, expiry: Date.now() + ttlMs });
    }
    invalidate(key) {
        this.store.delete(key);
    }
}
class InFlightTracker {
    pending = new Map();
    async dedupe(key, fn) {
        const existing = this.pending.get(key);
        if (existing)
            return existing;
        const promise = fn().finally(() => this.pending.delete(key));
        this.pending.set(key, promise);
        return promise;
    }
}
let MetricsService = class MetricsService {
    static { MetricsService_1 = this; }
    metricRepository;
    logger = new common_1.Logger(MetricsService_1.name);
    metricsBuffer = [];
    flushInterval;
    lastDataArrivalTime = Date.now();
    noDataAlertSent = false;
    noDataCheckInterval;
    cache = new MemoryCache();
    inFlight = new InFlightTracker();
    static CACHE_TTL = 30_000;
    constructor(metricRepository) {
        this.metricRepository = metricRepository;
    }
    onModuleInit() {
        this.flushInterval = setInterval(() => {
            this.flushMetrics();
        }, 240000);
        this.noDataCheckInterval = setInterval(() => {
            this.checkDataArrival();
        }, 60000);
    }
    onModuleDestroy() {
        clearInterval(this.flushInterval);
        clearInterval(this.noDataCheckInterval);
        this.flushMetrics();
    }
    appendToPostLog(message) {
        const logsDir = path.join(os.homedir(), 'Documentos/proyectoEduardo/Proyectos/Bucalemu/api-bucalemu-postgres/logs');
        const logFile = path.join(logsDir, 'logs-post.txt');
        try {
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            const timestamp = new Date().toISOString();
            fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
        }
        catch (e) {
            this.logger.error('Failed to write to logs-post.txt', e);
        }
    }
    checkDataArrival() {
        const timeSinceLastData = Date.now() - this.lastDataArrivalTime;
        if (timeSinceLastData > 1800000) {
            if (!this.noDataAlertSent) {
                this.appendToPostLog('ALERTA: Han pasado más de 30 minutos sin recibir datos nuevos.');
                this.noDataAlertSent = true;
            }
        }
    }
    async createMetric(dto) {
        this.lastDataArrivalTime = Date.now();
        this.noDataAlertSent = false;
        this.appendToPostLog(`Nuevo dato recibido - Nombre: ${dto.mt_name}, Value: ${dto.mt_value}`);
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
                .into('ssr_bucalemu')
                .values(dataToSave)
                .execute();
            this.logger.log(`Bulk inserted ${dataToSave.length} metrics`);
        }
        catch (error) {
            this.logger.error('Error in bulk insert', error);
            this.appendToPostLog(`ERROR de inserción a postgres: ${error instanceof Error ? error.message : String(error)}`);
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
        const cacheKey = 'latestForEachName';
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        return this.inFlight.dedupe(cacheKey, async () => {
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
                else if (metric.mt_name === 'BBAJO_NUEVO--slave.nivel_balto') {
                    finalName = 'BBAJO_NUEVO--slave.nivel_balto';
                }
                result[finalName] = {
                    value: finalValue,
                    time: metric.mt_time_2,
                };
            });
            this.cache.set(cacheKey, result, MetricsService_1.CACHE_TTL);
            return result;
        });
    }
    async findLastUpdateTime() {
        const result = await this.metricRepository
            .createQueryBuilder('metric')
            .select('MAX(metric.mt_time_2)', 'lastUpdateTime')
            .getRawOne();
        return result?.lastUpdateTime ?? null;
    }
    async findAllMeasurements() {
        const cacheKey = 'allMeasurements';
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        return this.inFlight.dedupe(cacheKey, async () => {
            const rawQuery = `
        SELECT subquery.*
        FROM (
          SELECT
            "mt_name", "mt_value", "mt_time_2",
            ROW_NUMBER() OVER (PARTITION BY "mt_name" ORDER BY "mt_time_2" DESC) as rn
          FROM "ssr_bucalemu"
          WHERE "mt_name" IN ('CASUTO--slave.AI12', 'BBAJO_NUEVO--slave.nivel_balto', 'ssr_bucalemu_bajo_nivel', 'ssr_nilahue_nivel')
            AND "mt_time_2" >= NOW() - INTERVAL '2 days'
        ) as subquery
        WHERE subquery.rn <= 100
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
                else if (name === 'BBAJO_NUEVO--slave.nivel_balto') {
                    name = 'ssr_bucalemu_alto_nivel';
                }
                if (!grouped[name]) {
                    grouped[name] = [];
                }
                grouped[name].push({
                    mt_value: value,
                    mt_time_2: new Date(row.mt_time_2),
                });
            });
            this.cache.set(cacheKey, grouped, MetricsService_1.CACHE_TTL);
            return grouped;
        });
    }
    async estimateEmptyingTimes() {
        const cacheKey = 'emptyingTimes';
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        return this.inFlight.dedupe(cacheKey, async () => {
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
          WHERE "mt_name" IN ('CASUTO--slave.AI12', 'BBAJO_NUEVO--slave.nivel_balto', 'ssr_bucalemu_bajo_nivel', 'ssr_nilahue_nivel')
            AND "mt_time_2" >= NOW() - INTERVAL '1 hour'
        ) t
        WHERE t.rn <= 2
        ORDER BY t."mt_name", t.rn;
      `;
                const rows = (await this.metricRepository.query(rawQuery));
                const grouped = {};
                rows.forEach((row) => {
                    let value = Number(row.mt_value);
                    let name = row.mt_name;
                    if (name === 'CASUTO--slave.AI12') {
                        name = 'ssr_casuto_nivel';
                        value = value / 100;
                    }
                    else if (name === 'BBAJO_NUEVO--slave.nivel_balto') {
                        name = 'ssr_bucalemu_alto_nivel';
                    }
                    if (!grouped[name])
                        grouped[name] = [];
                    grouped[name].push({
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
                    const key = `t_vaciado_${name.replace(/^ssr_/, '')}`;
                    result[key] = isNaN(segundos)
                        ? 'NaN'
                        : this.formatSecondsToDuration(Math.round(segundos));
                }
                this.cache.set(cacheKey, result, MetricsService_1.CACHE_TTL);
                return result;
            }
            catch (error) {
                this.logger.error('Error estimating emptying times', error);
                throw new common_1.InternalServerErrorException('Error estimating emptying times');
            }
        });
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
            time: row.mt_time_2,
            value: Number(row.mt_value),
        }));
    }
    async getSnapshot() {
        const [latest, levels, emptying, caudal] = await Promise.all([
            this.findLatestForEachName(),
            this.findAllMeasurements(),
            this.estimateEmptyingTimes(),
            this.getCaudal({}),
        ]);
        return { latest, levels, emptying, caudal };
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
    __param(0, (0, typeorm_1.InjectRepository)(metric_entity_1.Metric)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map