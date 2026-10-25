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
var SsrGonzalezService_1;
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsrGonzalezService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metrics_entity_1 = require("./models/metrics.entity");
let SsrGonzalezService = SsrGonzalezService_1 = class SsrGonzalezService {
    repo;
    logger = new common_1.Logger(SsrGonzalezService_1.name);
    constructor(repo) {
        this.repo = repo;
    }
    localMidnight(dateStr) {
        const noon = new Date(`${dateStr}T12:00:00Z`);
        const santiagoDate = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Santiago',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(noon);
        const utcMs = Date.UTC(...santiagoDate.split('-').map(Number));
        const offsetMs = utcMs - new Date(`${santiagoDate}T00:00:00Z`).getTime();
        return new Date(new Date(`${santiagoDate}T00:00:00Z`).getTime() + offsetMs);
    }
    normalizeDateRange(dto) {
        if (!dto.start || !dto.end)
            return null;
        const startDate = this.localMidnight(dto.start);
        const nextDayDate = new Date(`${dto.end}T12:00:00Z`);
        nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1);
        const nextDayStr = nextDayDate.toISOString().slice(0, 10);
        const endDate = this.localMidnight(nextDayStr);
        return { start: startDate, end: endDate };
    }
    async getSnapshot() {
        try {
            const results = await this.repo.query(`
        SELECT t.mt_name, t.mt_value, t.mt_time_2
        FROM ssr_gonzalez t
        INNER JOIN (
          SELECT mt_name, MAX(mt_time_2) AS last_time
          FROM ssr_gonzalez
          GROUP BY mt_name
        ) latest
        ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
      `);
            const prefix = 'SSR_GONZALEZ--slave.';
            const snapshot = results.reduce((acc, row) => {
                const key = row.mt_name.replace(prefix, '');
                acc[key] = {
                    value: Number(row.mt_value),
                    time: new Date(row.mt_time_2).toISOString(),
                };
                return acc;
            }, {});
            const calcularTiempoVaciado = async (nombreEstanque) => {
                const mediciones = await this.repo.find({
                    where: { mt_name: nombreEstanque },
                    order: { mt_time_2: 'DESC' },
                    take: 2,
                });
                if (mediciones.length < 2)
                    return { tiempo: 0, formatted: 'Llenando...' };
                const [actual, anterior] = mediciones;
                const [nivel_actual, nivel_anterior] = [
                    Number(actual.mt_value),
                    Number(anterior.mt_value),
                ];
                if (nivel_actual == nivel_anterior)
                    return { tiempo: 0, formatted: 'Nivel Estático' };
                const [t_actual, t_anterior] = [
                    actual.mt_time_2.getTime() / 1000,
                    anterior.mt_time_2.getTime() / 1000,
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
            const estanque1 = await calcularTiempoVaciado('SSR_GONZALEZ--slave.metalico1');
            const estanque2 = await calcularTiempoVaciado('SSR_GONZALEZ--slave.metalico2');
            return {
                snapshot,
                tiempo_vaciado: estanque1.tiempo,
                tiempo_vaciado_formatted: estanque1.formatted,
                tiempo_vaciado_2: estanque2.tiempo,
                tiempo_vaciado_2_formatted: estanque2.formatted,
            };
        }
        catch (error) {
            this.logger.error('Error en getSnapshot', error);
            throw error;
        }
    }
    async calculateAndCacheDaily(metricName, start, end) {
        try {
            const cached = await this.repo.query(`SELECT mt_day, mt_value FROM ssr_gonzalez_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`, [metricName, start, end]);
            const metricsMap = new Map();
            cached.forEach((row) => {
                const dateStr = typeof row.mt_day === 'string'
                    ? row.mt_day
                    : row.mt_day.toISOString().split('T')[0];
                metricsMap.set(dateStr, Number(row.mt_value));
            });
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
            FROM ssr_gonzalez
            WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
            GROUP BY mt_time_2::DATE
          )
          SELECT b.day, (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_gonzalez s_first ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_gonzalez s_last ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
          GROUP BY b.day
        `, [metricName, missingDates]);
                for (const row of calculated) {
                    const dateStr = typeof row.day === 'string'
                        ? row.day
                        : row.day.toISOString().split('T')[0];
                    const val = Number(row.daily_value || 0);
                    await this.repo.query(`INSERT INTO ssr_gonzalez_daily_metrics (mt_name, mt_day, mt_value) VALUES ($1, $2, $3) ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`, [metricName, dateStr, val]);
                    metricsMap.set(dateStr, val);
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
        this.logger.debug(`getTotalizador recibido: ${JSON.stringify(dto)}`);
        try {
            if (!dto?.start || !dto?.end)
                throw new Error('Rango de fechas inválido');
            return await this.calculateAndCacheDaily('SSR_GONZALEZ--slave.totalizador', dto.start, dto.end);
        }
        catch (error) {
            this.logger.error('Error en getTotalizador', error);
            throw error;
        }
    }
    async getHorometro(dto) {
        this.logger.debug(`getHorometro recibido: ${JSON.stringify(dto)}`);
        try {
            if (!dto?.start || !dto?.end)
                throw new Error('Rango de fechas inválido');
            return await this.calculateAndCacheDaily('SSR_GONZALEZ--slave.horometro', dto.start, dto.end);
        }
        catch (error) {
            this.logger.error('Error en getHorometro', error);
            throw error;
        }
    }
    async getNivel(dto) {
        this.logger.debug(`getNivel recibido: ${JSON.stringify(dto)}`);
        try {
            const range = this.normalizeDateRange(dto);
            const name = 'SSR_GONZALEZ--slave.metalico1';
            if (!range) {
                const results = await this.repo.find({
                    where: { mt_name: name },
                    order: { mt_time_2: 'DESC' },
                    take: 100,
                });
                return results
                    .reverse()
                    .map((r) => ({
                    time: r.mt_time_2.toISOString(),
                    value: Number(r.mt_value),
                }));
            }
            const results = await this.repo.find({
                where: {
                    mt_name: name,
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
            this.logger.error('Error en getNivel', error);
            throw error;
        }
    }
    async getNivel2(dto) {
        this.logger.debug(`getNivel2 recibido: ${JSON.stringify(dto)}`);
        try {
            const range = this.normalizeDateRange(dto);
            const name = 'SSR_GONZALEZ--slave.metalico2';
            if (!range) {
                const results = await this.repo.find({
                    where: { mt_name: name },
                    order: { mt_time_2: 'DESC' },
                    take: 100,
                });
                return results
                    .reverse()
                    .map((r) => ({
                    time: r.mt_time_2.toISOString(),
                    value: Number(r.mt_value),
                }));
            }
            const results = await this.repo.find({
                where: {
                    mt_name: name,
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
            this.logger.error('Error en getNivel2', error);
            throw error;
        }
    }
    async getCaudal(dto) {
        this.logger.debug(`getCaudal recibido: ${JSON.stringify(dto)}`);
        try {
            const range = this.normalizeDateRange(dto);
            const name = 'SSR_GONZALEZ--slave.caudal';
            if (!range) {
                const results = await this.repo.find({
                    where: { mt_name: name },
                    order: { mt_time_2: 'DESC' },
                    take: 100,
                });
                return results
                    .reverse()
                    .map((r) => ({
                    time: r.mt_time_2.toISOString(),
                    value: Number(r.mt_value),
                }));
            }
            const results = await this.repo.find({
                where: {
                    mt_name: name,
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
    async getPh(dto) {
        this.logger.debug(`getPh recibido: ${JSON.stringify(dto)}`);
        try {
            const range = this.normalizeDateRange(dto);
            const name = 'SSR_GONZALEZ--slave.ph';
            if (!range) {
                const results = await this.repo.find({
                    where: { mt_name: name },
                    order: { mt_time_2: 'DESC' },
                    take: 100,
                });
                return results
                    .reverse()
                    .map((r) => ({
                    time: r.mt_time_2.toISOString(),
                    value: Number(r.mt_value),
                }));
            }
            const results = await this.repo.find({
                where: {
                    mt_name: name,
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
            this.logger.error('Error en getPh', error);
            throw error;
        }
    }
};
exports.SsrGonzalezService = SsrGonzalezService;
exports.SsrGonzalezService = SsrGonzalezService = SsrGonzalezService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metrics_entity_1.Telemetria)),
    __metadata("design:paramtypes", [typeof (_a = typeof typeorm_2.Repository !== "undefined" && typeorm_2.Repository) === "function" ? _a : Object])
], SsrGonzalezService);
//# sourceMappingURL=metrics.service.js.map