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
exports.SsrRanguilService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metrics_entity_1 = require("./models/metrics.entity");
let SsrRanguilService = class SsrRanguilService {
    repo;
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
    SELECT t.mt_name, t.mt_value, t.mt_time_2
    FROM ssr_ranguil t
    INNER JOIN (
      SELECT mt_name, MAX(mt_time_2) AS last_time
      FROM ssr_ranguil
      GROUP BY mt_name
    ) latest
    ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
  `);
            const prefix = 'SSR_RANGUIL--slave.';
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
                if (mediciones.length < 2) {
                    return { tiempo: 0, formatted: 'Llenando...' };
                }
                const [actual, anterior] = mediciones;
                const nivel_actual = Number(actual.mt_value);
                const nivel_anterior = Number(anterior.mt_value);
                const t_actual = actual.mt_time_2.getTime() / 1000;
                const t_anterior = anterior.mt_time_2.getTime() / 1000;
                if (!(nivel_actual < nivel_anterior && t_actual > t_anterior)) {
                    return { tiempo: 0, formatted: 'Llenando...' };
                }
                const tasa_vaciado = (nivel_anterior - nivel_actual) / (t_actual - t_anterior);
                const tiempo = Math.round(nivel_actual / tasa_vaciado);
                const h = Math.floor(tiempo / 3600);
                const m = Math.floor((tiempo % 3600) / 60);
                const s = tiempo % 60;
                const formatted = `${h.toString().padStart(2, '0')} h ${m
                    .toString()
                    .padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`;
                return { tiempo, formatted };
            };
            const est_1 = await calcularTiempoVaciado('SSR_RANGUIL--slave.estanque');
            const est_2 = await calcularTiempoVaciado('SSR_RANGUIL--slave.estanque_2');
            return {
                snapshot,
                tiempo_vaciado_est_1: est_1.tiempo,
                tiempo_vaciado_est_1_formatted: est_1.formatted,
                tiempo_vaciado_est_2: est_2.tiempo,
                tiempo_vaciado_est_2_formatted: est_2.formatted,
            };
        }
        catch (error) {
            console.error('Error al obtener datos:' + error);
            return {
                snapshot: {},
                tiempo_vaciado_est_1: 0,
                tiempo_vaciado_est_1_formatted: 'Error al calcular tiempo de vaciado',
                tiempo_vaciado_est_2: 0,
                tiempo_vaciado_est_2_formatted: 'Error al calcular tiempo de vaciado',
            };
        }
    }
    async calculateAndCacheDaily(metricName, start, end) {
        const cached = await this.repo.query(`SELECT mt_day, mt_value FROM ssr_ranguil_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`, [metricName, start, end]);
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
            if (!metricsMap.has(dateStr) || dateStr === todayStr) {
                missingDates.push(dateStr);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        if (missingDates.length > 0) {
            const calculated = await this.repo.query(`
        WITH bounds AS (
          SELECT mt_time_2::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_ranguil
          WHERE mt_name = $1 AND mt_time_2::DATE = ANY($2::DATE[])
          GROUP BY mt_time_2::DATE
        )
        SELECT b.day,
          (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_ranguil s_first
          ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_ranguil s_last
          ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
        GROUP BY b.day
        `, [metricName, missingDates]);
            for (const row of calculated) {
                const dateStr = typeof row.day === 'string'
                    ? row.day
                    : row.day.toISOString().split('T')[0];
                const val = Number(row.daily_value || 0);
                await this.repo.query(`INSERT INTO ssr_ranguil_daily_metrics (mt_name, mt_day, mt_value) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`, [metricName, dateStr, val]);
                metricsMap.set(dateStr, val);
            }
        }
        const results = [];
        currentDate = new Date(`${start}T00:00:00Z`);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toISOString().split('T')[0];
            if (metricsMap.has(dateStr)) {
                results.push({ time: dateStr, value: metricsMap.get(dateStr) });
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return results;
    }
    async getTotalizador(dto) {
        if (!dto || !dto.start || !dto.end)
            throw new Error('Se requiere rango de fechas válido.');
        return this.calculateAndCacheDaily('SSR_RANGUIL--slave.totalizador', dto.start, dto.end);
    }
    async getHorometro(dto) {
        if (!dto || !dto.start || !dto.end)
            throw new Error('Se requiere rango de fechas válido.');
        return this.calculateAndCacheDaily('SSR_RANGUIL--slave.horometro', dto.start, dto.end);
    }
    async getKwh(dto) {
        if (!dto || !dto.start || !dto.end)
            throw new Error('Se requiere rango de fechas válido.');
        return this.calculateAndCacheDaily('SSR_RANGUIL--slave.kwh', dto.start, dto.end);
    }
    async getNivel(dto) {
        const range = this.normalizeDateRange(dto);
        if (range) {
            const { start, end } = range;
            const results = await this.repo.find({
                where: {
                    mt_name: 'SSR_RANGUIL--slave.estanque',
                    mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start AND ${alias} < :end`, {
                        start,
                        end,
                    }),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((row) => ({
                time: row.mt_time_2.toISOString(),
                value: Number(row.mt_value),
            }));
        }
        const takeLimit = dto.limit && !isNaN(Number(dto.limit)) ? Number(dto.limit) : 100;
        const results = await this.repo.find({
            where: { mt_name: 'SSR_RANGUIL--slave.estanque' },
            order: { mt_time_2: 'DESC' },
            take: takeLimit,
        });
        return results.reverse().map((row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
        }));
    }
    async getCorriente(dto) {
        const range = this.normalizeDateRange(dto);
        const fetchVariable = async (variable) => {
            const mtName = `SSR_RANGUIL--slave.${variable}`;
            if (!range) {
                const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
                const results = await this.repo.find({
                    where: {
                        mt_name: mtName,
                        mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start`, { start }),
                    },
                    order: { mt_time_2: 'ASC' },
                });
                return results.map((row) => ({
                    time: row.mt_time_2.toISOString(),
                    value: Number(row.mt_value),
                }));
            }
            const { start, end } = range;
            const results = await this.repo.find({
                where: {
                    mt_name: mtName,
                    mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start AND ${alias} < :end`, {
                        start,
                        end,
                    }),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((row) => ({
                time: row.mt_time_2.toISOString(),
                value: Number(row.mt_value),
            }));
        };
        const [i1, i2, i3] = await Promise.all([
            fetchVariable('i1'),
            fetchVariable('i2'),
            fetchVariable('i3'),
        ]);
        return { i1, i2, i3 };
    }
    async getVoltaje(dto) {
        const range = this.normalizeDateRange(dto);
        const fetchVariable = async (variable) => {
            const mtName = `SSR_RANGUIL--slave.${variable}`;
            if (!range) {
                const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
                const results = await this.repo.find({
                    where: {
                        mt_name: mtName,
                        mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start`, { start }),
                    },
                    order: { mt_time_2: 'ASC' },
                });
                return results.map((row) => ({
                    time: row.mt_time_2.toISOString(),
                    value: Number(row.mt_value),
                }));
            }
            const { start, end } = range;
            const results = await this.repo.find({
                where: {
                    mt_name: mtName,
                    mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start AND ${alias} < :end`, {
                        start,
                        end,
                    }),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((row) => ({
                time: row.mt_time_2.toISOString(),
                value: Number(row.mt_value),
            }));
        };
        const [v1, v2, v3] = await Promise.all([
            fetchVariable('v1'),
            fetchVariable('v2'),
            fetchVariable('v3'),
        ]);
        return { v1, v2, v3 };
    }
    async getPresion(dto) {
        const range = this.normalizeDateRange(dto);
        if (!range) {
            const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
            const results = await this.repo.find({
                where: {
                    mt_name: 'SSR_RANGUIL--slave.presion',
                    mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start`, { start }),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((row) => ({
                time: row.mt_time_2.toISOString(),
                value: Number(row.mt_value),
            }));
        }
        const { start, end } = range;
        const results = await this.repo.find({
            where: {
                mt_name: 'SSR_RANGUIL--slave.presion',
                mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start AND ${alias} < :end`, {
                    start,
                    end,
                }),
            },
            order: { mt_time_2: 'ASC' },
        });
        return results.map((row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
        }));
    }
    async getNivel2(dto) {
        const range = this.normalizeDateRange(dto);
        if (range) {
            const { start, end } = range;
            const results = await this.repo.find({
                where: {
                    mt_name: 'SSR_RANGUIL--slave.estanque_2',
                    mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start AND ${alias} < :end`, {
                        start,
                        end,
                    }),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((row) => ({
                time: row.mt_time_2.toISOString(),
                value: Number(row.mt_value),
            }));
        }
        const takeLimit = dto.limit && !isNaN(Number(dto.limit)) ? Number(dto.limit) : 100;
        const results = await this.repo.find({
            where: { mt_name: 'SSR_RANGUIL--slave.estanque_2' },
            order: { mt_time_2: 'DESC' },
            take: takeLimit,
        });
        return results.reverse().map((row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
        }));
    }
    async getCaudal(dto) {
        const range = this.normalizeDateRange(dto);
        if (range) {
            const { start, end } = range;
            const results = await this.repo.find({
                where: {
                    mt_name: 'SSR_RANGUIL--slave.caudal',
                    mt_time_2: (0, typeorm_2.Raw)((alias) => `${alias} >= :start AND ${alias} < :end`, {
                        start,
                        end,
                    }),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((row) => ({
                time: row.mt_time_2.toISOString(),
                value: Number(row.mt_value),
            }));
        }
        const takeLimit = dto.limit && !isNaN(Number(dto.limit)) ? Number(dto.limit) : 100;
        const results = await this.repo.find({
            where: { mt_name: 'SSR_RANGUIL--slave.caudal' },
            order: { mt_time_2: 'DESC' },
            take: takeLimit,
        });
        return results.reverse().map((row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
        }));
    }
};
exports.SsrRanguilService = SsrRanguilService;
exports.SsrRanguilService = SsrRanguilService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metrics_entity_1.Telemetria)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SsrRanguilService);
//# sourceMappingURL=metrics.service.js.map