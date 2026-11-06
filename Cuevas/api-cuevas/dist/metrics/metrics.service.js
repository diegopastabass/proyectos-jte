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
var SsrCuevasService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsrCuevasService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const fs = __importStar(require("fs"));
const metrics_entity_1 = require("./models/metrics.entity");
const sensors_1 = require("./models/sensors");
let SsrCuevasService = SsrCuevasService_1 = class SsrCuevasService {
    repo;
    logger = new common_1.Logger(SsrCuevasService_1.name);
    constructor(repo) {
        this.repo = repo;
    }
    normalizeDateRange(dto) {
        if (!dto.start || !dto.end)
            return null;
        const startDate = new Date(`${dto.start}T00:00:00Z`);
        const nextDay = new Date(`${dto.end}T00:00:00Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        const endDate = new Date(`${nextDay.toISOString().slice(0, 10)}T00:00:00Z`);
        return { start: startDate, end: endDate };
    }
    async getAlarmLevel() {
        try {
            const envPath = 'C:\\AutomatizationServices\\cuevas\\.env';
            const content = await fs.promises.readFile(envPath, 'utf8');
            const match = content.match(/^NIVEL_ALERTA=(.+)$/m);
            if (match && match[1]) {
                const val = parseFloat(match[1].trim());
                if (!isNaN(val))
                    return val;
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                this.logger.error('Error al leer NIVEL_ALERTA desde .env', error);
            }
        }
        return 2;
    }
    async getSnapshot() {
        const nivel_alerta = await this.getAlarmLevel();
        try {
            const results = await this.repo.query(`
    SELECT t.mt_name, t.mt_value, t.mt_time_2
    FROM ssr_cuevas t
    INNER JOIN (
      SELECT mt_name, MAX(mt_time_2) AS last_time
      FROM ssr_cuevas
      GROUP BY mt_name
    ) latest
    ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
  `);
            const snapshot = results.reduce((acc, row) => {
                acc[(0, sensors_1.cleanSensorName)(row.mt_name)] = {
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
            const est_1 = await calcularTiempoVaciado(sensors_1.SENSOR_NAMES.estanque);
            const est_2 = await calcularTiempoVaciado(sensors_1.SENSOR_NAMES.nivel_2);
            return {
                snapshot,
                tiempo_vaciado_est_1: est_1.tiempo,
                tiempo_vaciado_est_1_formatted: est_1.formatted,
                tiempo_vaciado_est_2: est_2.tiempo,
                tiempo_vaciado_est_2_formatted: est_2.formatted,
                nivel_alerta,
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
                nivel_alerta,
            };
        }
    }
    async calculateAndCacheDaily(metricName, start, end) {
        try {
            const cached = await this.repo.query(`SELECT mt_day, mt_value FROM ssr_cuevas_daily_metrics WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`, [metricName, start, end]);
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
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }
            if (missingDates.length > 0) {
                const calculated = await this.repo.query(`
          WITH bounds AS (
            SELECT (mt_time_2 AT TIME ZONE 'UTC')::DATE AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
            FROM ssr_cuevas
            WHERE mt_name = $1 AND (mt_time_2 AT TIME ZONE 'UTC')::DATE = ANY($2::DATE[])
            GROUP BY (mt_time_2 AT TIME ZONE 'UTC')::DATE
          )
          SELECT b.day,
            (MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6)))) AS daily_value
          FROM bounds b
          LEFT JOIN ssr_cuevas s_first
            ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
          LEFT JOIN ssr_cuevas s_last
            ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
          GROUP BY b.day
          `, [metricName, missingDates]);
                for (const row of calculated) {
                    const dateStr = typeof row.day === 'string'
                        ? row.day
                        : row.day.toISOString().split('T')[0];
                    const val = Number(row.daily_value || 0);
                    await this.repo.query(`INSERT INTO ssr_cuevas_daily_metrics (mt_name, mt_day, mt_value) 
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
                currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            }
            return results;
        }
        catch (error) {
            this.logger.error(`Error en calculateAndCacheDaily para ${metricName}`, error);
            throw error;
        }
    }
    async getTotalizador(dto) {
        if (!dto || !dto.start || !dto.end)
            throw new common_1.BadRequestException('Se requiere rango de fechas válido.');
        return this.calculateAndCacheDaily(sensors_1.SENSOR_NAMES.totalizador, dto.start, dto.end);
    }
    async getHorometro(dto) {
        if (!dto || !dto.start || !dto.end)
            throw new common_1.BadRequestException('Se requiere rango de fechas válido.');
        return this.calculateAndCacheDaily(sensors_1.SENSOR_NAMES.horometro, dto.start, dto.end);
    }
    async getKwh(dto) {
        if (!dto || !dto.start || !dto.end)
            throw new common_1.BadRequestException('Se requiere rango de fechas válido.');
        return this.calculateAndCacheDaily(sensors_1.SENSOR_NAMES.kwh, dto.start, dto.end);
    }
    async getSeries(mtName, dto) {
        const range = this.normalizeDateRange(dto);
        const toMetric = (row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
        });
        if (range) {
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
            return results.map(toMetric);
        }
        const takeLimit = dto.limit && !isNaN(Number(dto.limit)) ? Number(dto.limit) : 100;
        const results = await this.repo.find({
            where: { mt_name: mtName },
            order: { mt_time_2: 'DESC' },
            take: takeLimit,
        });
        return results.reverse().map(toMetric);
    }
    async getPozoSeries(variables, dto) {
        const range = this.normalizeDateRange(dto);
        const fetchVariable = async (variable) => {
            const mtName = (0, sensors_1.pozoSensor)(variable);
            const results = await this.repo.find({
                where: {
                    mt_name: mtName,
                    mt_time_2: range
                        ? (0, typeorm_2.Raw)((alias) => `${alias} >= :start AND ${alias} < :end`, range)
                        : (0, typeorm_2.Raw)((alias) => `${alias} >= :start`, {
                            start: new Date(Date.now() - 6 * 60 * 60 * 1000),
                        }),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((row) => ({
                time: row.mt_time_2.toISOString(),
                value: Number(row.mt_value),
            }));
        };
        const series = await Promise.all(variables.map(fetchVariable));
        return Object.fromEntries(variables.map((variable, i) => [variable, series[i]]));
    }
    getNivel(dto) {
        return this.getSeries(sensors_1.SENSOR_NAMES.estanque, dto);
    }
    getNivel2(dto) {
        return this.getSeries(sensors_1.SENSOR_NAMES.nivel_2, dto);
    }
    getVoltaje2(dto) {
        return this.getSeries(sensors_1.SENSOR_NAMES.voltaje_2, dto);
    }
    getFreatico(dto) {
        return this.getSeries(sensors_1.SENSOR_NAMES.freatico, dto);
    }
    getCaudal(dto) {
        return this.getSeries(sensors_1.SENSOR_NAMES.caudal, dto);
    }
    getCorriente(dto) {
        return this.getPozoSeries(['I1', 'I2', 'I3'], dto);
    }
    getVoltaje(dto) {
        return this.getPozoSeries(['L1', 'L2', 'L3'], dto);
    }
};
exports.SsrCuevasService = SsrCuevasService;
exports.SsrCuevasService = SsrCuevasService = SsrCuevasService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metrics_entity_1.Telemetria)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SsrCuevasService);
//# sourceMappingURL=metrics.service.js.map