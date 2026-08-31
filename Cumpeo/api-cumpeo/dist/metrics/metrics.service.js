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
var SsrCumpeoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsrCumpeoService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metrics_entity_1 = require("./models/metrics.entity");
let SsrCumpeoService = SsrCumpeoService_1 = class SsrCumpeoService {
    repo;
    logger = new common_1.Logger(SsrCumpeoService_1.name);
    constructor(repo) {
        this.repo = repo;
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
        FROM ssr_cumpeo t
        INNER JOIN (
          SELECT name, MAX(insert_time) AS last_time
          FROM ssr_cumpeo
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
            const calcularTiempoVaciado = async (nombreEstanque) => {
                const mediciones = await this.repo.query(`SELECT value, insert_time FROM ssr_cumpeo WHERE name = $1 ORDER BY insert_time DESC LIMIT 2`, [nombreEstanque]);
                if (mediciones.length < 2)
                    return { tiempo: 0, formatted: 'Llenando...' };
                const [actual, anterior] = mediciones;
                const [nivel_actual, nivel_anterior] = [
                    Number(actual.value),
                    Number(anterior.value),
                ];
                const [t_actual, t_anterior] = [
                    new Date(actual.insert_time).getTime() / 1000,
                    new Date(anterior.insert_time).getTime() / 1000,
                ];
                if (!(nivel_actual < nivel_anterior && t_actual > t_anterior))
                    return { tiempo: 0, formatted: 'Llenando...' };
                const tasa_vaciado = (nivel_anterior - nivel_actual) / (t_actual - t_anterior);
                const tiempo = Math.round(nivel_actual / tasa_vaciado);
                const h = Math.floor(tiempo / 3600);
                const m = Math.floor((tiempo % 3600) / 60);
                const s = tiempo % 60;
                return {
                    tiempo,
                    formatted: `${h.toString().padStart(2, '0')} h ${m.toString().padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`,
                };
            };
            const estanque = await calcularTiempoVaciado('SSR_CUMPEO--slave.estanque');
            return {
                snapshot,
                tiempo_vaciado: estanque.tiempo,
                tiempo_vaciado_formatted: estanque.formatted,
            };
        }
        catch (error) {
            this.logger.error('Error en getSnapshotCumpeo', error);
            throw error;
        }
    }
    async calculateAndCacheDaily(metricName, start, end) {
        try {
            const cached = await this.repo.query(`SELECT mt_day, mt_value FROM ssr_cumpeo_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`, [metricName, start, end]);
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
            FROM ssr_cumpeo
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day, (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_cumpeo s_first ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_cumpeo s_last ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
          GROUP BY b.day
        `, [metricName, missingDates]);
                for (const row of calculated) {
                    const dateStr = typeof row.day === 'string'
                        ? row.day
                        : row.day.toISOString().split('T')[0];
                    await this.repo.query(`INSERT INTO ssr_cumpeo_daily_metrics (mt_name, mt_day, mt_value) VALUES ($1, $2, $3) ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`, [metricName, dateStr, Number(row.daily_value || 0)]);
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
    async getTotalizador(dto) {
        try {
            if (!dto?.start || !dto?.end)
                throw new Error('Rango inválido');
            return await this.calculateAndCacheDaily('SSR_CUMPEO--slave.totalizador', dto.start, dto.end);
        }
        catch (error) {
            this.logger.error('Error en getTotalizador', error);
            throw error;
        }
    }
    async getHorometro(dto) {
        try {
            if (!dto?.start || !dto?.end)
                throw new Error('Rango inválido');
            return await this.calculateAndCacheDaily('SSR_CUMPEO--slave.horometro', dto.start, dto.end);
        }
        catch (error) {
            this.logger.error('Error en getHorometro', error);
            throw error;
        }
    }
    async getNivel(dto) {
        try {
            const range = this.normalizeDateRange(dto);
            if (range) {
                const results = await this.repo.find({
                    where: {
                        mt_name: 'SSR_CUMPEO--slave.estanque',
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
            const results = await this.repo.find({
                where: { mt_name: 'SSR_CUMPEO--slave.estanque' },
                order: { mt_time_2: 'DESC' },
                take: dto.limit ? Number(dto.limit) : 100,
            });
            return results.reverse().map((r) => ({
                time: r.mt_time_2.toISOString(),
                value: Number(r.mt_value),
            }));
        }
        catch (error) {
            this.logger.error('Error en getNivel', error);
            throw error;
        }
    }
    async getNivel2(dto) {
        try {
            const range = this.normalizeDateRange(dto);
            if (range) {
                const results = await this.repo.find({
                    where: {
                        mt_name: 'SSR_CUMPEO--slave.estanque_2',
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
            const results = await this.repo.find({
                where: { mt_name: 'SSR_CUMPEO--slave.estanque_2' },
                order: { mt_time_2: 'DESC' },
                take: dto.limit ? Number(dto.limit) : 100,
            });
            return results.reverse().map((r) => ({
                time: r.mt_time_2.toISOString(),
                value: Number(r.mt_value),
            }));
        }
        catch (error) {
            this.logger.error('Error en getNivel2', error);
            throw error;
        }
    }
    async getCaudal(dto) {
        try {
            const range = this.normalizeDateRange(dto);
            if (!range) {
                const results = await this.repo.find({
                    where: { mt_name: 'SSR_CUMPEO--slave.caudal_pozos' },
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
                    mt_name: 'SSR_CUMPEO--slave.caudal_pozos',
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
exports.SsrCumpeoService = SsrCumpeoService;
exports.SsrCumpeoService = SsrCumpeoService = SsrCumpeoService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metrics_entity_1.Telemetria)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SsrCumpeoService);
//# sourceMappingURL=metrics.service.js.map