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
var SsrTrinidadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsrTrinidadService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const mysql = __importStar(require("mysql2/promise"));
const metrics_entity_1 = require("./models/metrics.entity");
let SsrTrinidadService = SsrTrinidadService_1 = class SsrTrinidadService {
    repo;
    logger = new common_1.Logger(SsrTrinidadService_1.name);
    mysqlPool;
    constructor(repo) {
        this.repo = repo;
    }
    onModuleInit() {
        this.mysqlPool = mysql.createPool({
            host: process.env.MY_HOST,
            user: process.env.MY_USER,
            password: process.env.MY_PASSWORD,
            database: process.env.MY_DATABASE,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
    }
    async onModuleDestroy() {
        if (this.mysqlPool) {
            await this.mysqlPool.end();
        }
    }
    normalizeDateRange(dto) {
        if (!dto.start || !dto.end)
            return null;
        const startDate = new Date(`${dto.start}T00:00:00Z`);
        const nextDay = new Date(dto.end);
        nextDay.setDate(nextDay.getDate() + 1);
        const endDate = new Date(`${nextDay.toISOString().slice(0, 10)}T00:00:00Z`);
        return { start: startDate, end: endDate };
    }
    async getSnapshot() {
        try {
            const results = await this.repo.query(`
        SELECT t.name, t.value, t.insert_time
        FROM ssr_trinidad t
        INNER JOIN (
          SELECT name, MAX(insert_time) AS last_time
          FROM ssr_trinidad
          GROUP BY name
        ) latest
        ON t.name = latest.name AND t.insert_time = latest.last_time
      `);
            const snapshot = results.reduce((acc, row) => {
                acc[row.name] = {
                    value: Number(row.value),
                    time: new Date(row.insert_time).toISOString(),
                };
                return acc;
            }, {});
            const [rows] = await this.mysqlPool.query(`
        SELECT mt_value, mt_time_2 
        FROM apr_marchigue
        WHERE mt_name = 'TK_MARCHIGUE--slave.AI12'
        ORDER BY mt_time_2 DESC
        LIMIT 2;
      `);
            let estanqueTiempo = 0;
            let estanqueFormatted = 'Llenando...';
            if (rows.length > 0) {
                snapshot['estanque'] = {
                    value: Number(rows[0].mt_value),
                    time: new Date(rows[0].mt_time_2).toISOString(),
                };
            }
            if (rows.length >= 2) {
                const [actual, anterior] = rows;
                const [nivel_actual, nivel_anterior] = [
                    Number(actual.mt_value),
                    Number(anterior.mt_value),
                ];
                const [t_actual, t_anterior] = [
                    new Date(actual.mt_time_2).getTime() / 1000,
                    new Date(anterior.mt_time_2).getTime() / 1000,
                ];
                if (nivel_actual < nivel_anterior && t_actual > t_anterior) {
                    const tasa_vaciado = (nivel_anterior - nivel_actual) / (t_actual - t_anterior);
                    const tiempo = Math.round(nivel_actual / tasa_vaciado);
                    const h = Math.floor(tiempo / 3600);
                    const m = Math.floor((tiempo % 3600) / 60);
                    const s = tiempo % 60;
                    estanqueTiempo = tiempo;
                    estanqueFormatted = `${h.toString().padStart(2, '0')} h ${m.toString().padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`;
                }
            }
            return {
                snapshot,
                tiempo_vaciado: estanqueTiempo,
                tiempo_vaciado_formatted: estanqueFormatted,
            };
        }
        catch (error) {
            this.logger.error('Error en getSnapshot', error);
            throw error;
        }
    }
    async calculateAndCacheDaily(metricName, start, end) {
        try {
            const cached = await this.repo.query(`SELECT mt_day, mt_value FROM ssr_trinidad_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`, [metricName, start, end]);
            const metricsMap = new Map();
            cached.forEach((row) => metricsMap.set(typeof row.mt_day === 'string'
                ? row.mt_day
                : row.mt_day.toISOString().split('T')[0], Number(row.mt_value)));
            const missingDates = [];
            let currentDate = new Date(`${start}T00:00:00Z`);
            const endDate = new Date(`${end}T00:00:00Z`);
            const todayStr = new Date().toISOString().split('T')[0];
            while (currentDate <= endDate) {
                const dateStr = currentDate.toISOString().split('T')[0];
                if (!metricsMap.has(dateStr) || dateStr === todayStr)
                    missingDates.push(dateStr);
                currentDate.setDate(currentDate.getDate() + 1);
            }
            if (missingDates.length > 0) {
                const calculated = await this.repo.query(`
          WITH bounds AS (
            SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
            FROM ssr_trinidad
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day, (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_trinidad s_first ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_trinidad s_last ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
          GROUP BY b.day
        `, [metricName, missingDates]);
                for (const row of calculated) {
                    const dateStr = typeof row.day === 'string'
                        ? row.day
                        : row.day.toISOString().split('T')[0];
                    await this.repo.query(`INSERT INTO ssr_trinidad_daily_metrics (mt_name, mt_day, mt_value) VALUES ($1, $2, $3) ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`, [metricName, dateStr, Number(row.daily_value || 0)]);
                    metricsMap.set(dateStr, Number(row.daily_value || 0));
                }
            }
            const results = [];
            currentDate = new Date(`${start}T00:00:00Z`);
            while (currentDate <= endDate) {
                const dateStr = currentDate.toISOString().split('T')[0];
                if (metricsMap.has(dateStr))
                    results.push({ time: dateStr, value: metricsMap.get(dateStr) });
                currentDate.setDate(currentDate.getDate() + 1);
            }
            return results;
        }
        catch (error) {
            this.logger.error(`Error en calculateAndCacheDaily para ${metricName}`, error);
            throw error;
        }
    }
    async getTotalizador_pozo(dto) {
        try {
            if (!dto?.start || !dto?.end)
                throw new Error('Rango inválido');
            return await this.calculateAndCacheDaily('SSR_TRINIDAD--slave.totalizador_pozo', dto.start, dto.end);
        }
        catch (error) {
            this.logger.error('Error en getTotalizadosr_pozo', error);
            throw error;
        }
    }
    async getTotalizador_sentina(dto) {
        try {
            if (!dto?.start || !dto?.end)
                throw new Error('Rango inválido');
            return await this.calculateAndCacheDaily('SSR_TRINIDAD--slave.totalizador_sentina', dto.start, dto.end);
        }
        catch (error) {
            this.logger.error('Error en getTotalizador_sentina', error);
            throw error;
        }
    }
    async getHorometro_e1(dto) {
        try {
            if (!dto?.start || !dto?.end)
                throw new Error('Rango inválido');
            return await this.calculateAndCacheDaily('SSR_TRINIDAD--slave.horometro_elevadora_1', dto.start, dto.end);
        }
        catch (error) {
            this.logger.error('Error en getHorometro', error);
            throw error;
        }
    }
    async getHorometro_e2(dto) {
        try {
            if (!dto?.start || !dto?.end)
                throw new Error('Rango inválido');
            return await this.calculateAndCacheDaily('SSR_TRINIDAD--slave.horometro_elevadora_2', dto.start, dto.end);
        }
        catch (error) {
            this.logger.error('Error en getHorometro', error);
            throw error;
        }
    }
    async getHorometro_pozo(dto) {
        try {
            if (!dto?.start || !dto?.end)
                throw new Error('Rango inválido');
            return await this.calculateAndCacheDaily('SSR_TRINIDAD--slave.horometro_bomba_pozo', dto.start, dto.end);
        }
        catch (error) {
            this.logger.error('Error en getHorometro_pozo', error);
            throw error;
        }
    }
    async getNivel(dto) {
        try {
            const range = this.normalizeDateRange(dto);
            if (range) {
                const [rows] = await this.mysqlPool.query(`SELECT mt_value, mt_time_2 
           FROM apr_marchigue 
           WHERE mt_name = 'TK_MARCHIGUE--slave.AI12' 
             AND mt_time_2 >= ? AND mt_time_2 < ?
           ORDER BY mt_time_2 ASC`, [range.start, range.end]);
                return rows.map((r) => ({
                    time: new Date(r.mt_time_2).toISOString(),
                    value: Number(r.mt_value),
                }));
            }
            const limit = dto.limit ? Number(dto.limit) : 100;
            const [rows] = await this.mysqlPool.query(`SELECT mt_value, mt_time_2 
         FROM apr_marchigue 
         WHERE mt_name = 'TK_MARCHIGUE--slave.AI12' 
         ORDER BY mt_time_2 DESC 
         LIMIT ?`, [limit]);
            return rows.reverse().map((r) => ({
                time: new Date(r.mt_time_2).toISOString(),
                value: Number(r.mt_value),
            }));
        }
        catch (error) {
            this.logger.error('Error en getNivel', error);
            throw error;
        }
    }
    async getCaudal(dto) {
        try {
            const range = this.normalizeDateRange(dto);
            if (!range) {
                const results = await this.repo.find({
                    where: { mt_name: 'SSR_TRINIDAD--slave.caudal' },
                    order: { mt_time_2: 'DESC' },
                    take: 100,
                });
                return results.reverse().map((r) => ({
                    time: r.mt_time_2.toISOString(),
                    value: Number(r.mt_value),
                }));
            }
            const results = await this.repo.find({
                where: {
                    mt_name: 'SSR_TRINIDAD--slave.caudal_pozo',
                    mt_time_2: (0, typeorm_2.Raw)((a) => `${a} >= :start AND ${a} < :end`, {
                        start: range.start,
                        end: range.end,
                    }),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((r) => ({
                time: r.mt_time_2.toISOString(),
                value: Number(r.mt_value),
            }));
        }
        catch (error) {
            this.logger.error('Error en getCaudal', error);
            throw error;
        }
    }
};
exports.SsrTrinidadService = SsrTrinidadService;
exports.SsrTrinidadService = SsrTrinidadService = SsrTrinidadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metrics_entity_1.Telemetria)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SsrTrinidadService);
//# sourceMappingURL=metrics.service.js.map