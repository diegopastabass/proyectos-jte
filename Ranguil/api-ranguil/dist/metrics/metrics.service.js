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
exports.SsrNerquihueService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metrics_entity_1 = require("./models/metrics.entity");
let SsrNerquihueService = class SsrNerquihueService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    normalizeDateRange(dto) {
        if (!dto.start || !dto.end)
            return null;
        const start = new Date(`${dto.start}T00:00:00`);
        const end = new Date(`${dto.end}T23:59:59`);
        console.log('🔹 [normalizeDateRange] DTO recibido:', dto);
        console.log('🔹 [normalizeDateRange] Start:', start.toISOString());
        console.log('🔹 [normalizeDateRange] End:', end.toISOString());
        return { start, end };
    }
    async getSnapshot() {
        const results = await this.repo.query(`
      SELECT t.mt_name, t.mt_value, t.mt_time_2
      FROM ssr_nerquihue t
      INNER JOIN (
        SELECT mt_name, MAX(mt_time_2) AS last_time
        FROM ssr_nerquihue
        GROUP BY mt_name
      ) latest
      ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
    `);
        const prefix = 'SSR_NERQUIHUE--slave.';
        const snapshot = results.reduce((acc, row) => {
            const key = row.mt_name.replace(prefix, '');
            acc[key] = {
                value: Number(row.mt_value),
                time: new Date(row.mt_time_2).toISOString(),
            };
            return acc;
        }, {});
        const nivelResults = await this.repo.find({
            where: { mt_name: 'SSR_NERQUIHUE--slave.estanque' },
            order: { mt_time_2: 'DESC' },
            take: 2,
        });
        let tiempo_vaciado = 0;
        let tiempo_vaciado_formatted = 'Llenando...';
        if (nivelResults.length === 2) {
            const [actual, anterior] = nivelResults;
            const nivel_actual = Number(actual.mt_value);
            const nivel_anterior = Number(anterior.mt_value);
            const timestamp_actual = actual.mt_time_2.getTime() / 1000;
            const timestamp_anterior = anterior.mt_time_2.getTime() / 1000;
            if (nivel_actual < nivel_anterior &&
                timestamp_actual > timestamp_anterior) {
                const tasa_vaciado = (nivel_anterior - nivel_actual) /
                    (timestamp_actual - timestamp_anterior);
                tiempo_vaciado = Math.round(nivel_actual / tasa_vaciado);
                const h = Math.floor(tiempo_vaciado / 3600);
                const m = Math.floor((tiempo_vaciado % 3600) / 60);
                const s = tiempo_vaciado % 60;
                tiempo_vaciado_formatted = `${h.toString().padStart(2, '0')} h ${m
                    .toString()
                    .padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`;
            }
        }
        return { snapshot, tiempo_vaciado, tiempo_vaciado_formatted };
    }
    async getTotalizador(dto) {
        const range = this.normalizeDateRange(dto);
        if (!range)
            throw new Error('Se requiere rango de fechas válido.');
        const { start, end } = range;
        const results = await this.repo.query(`
        WITH bounds AS (
          SELECT DATE(mt_time_2) AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_nerquihue
          WHERE mt_name = 'SSR_NERQUIHUE--slave.totalizador'
          AND mt_time_2 BETWEEN ? AND ?
          GROUP BY DATE(mt_time_2)
        )
        SELECT b.day,
          (CAST(s_last.mt_value AS DECIMAL(30,6)) - CAST(s_first.mt_value AS DECIMAL(30,6))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_nerquihue s_first
          ON s_first.mt_name = 'SSR_NERQUIHUE--slave.totalizador' AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_nerquihue s_last
          ON s_last.mt_name = 'SSR_NERQUIHUE--slave.totalizador' AND s_last.mt_time_2 = b.last_ts
        ORDER BY b.day ASC
      `, [start, end]);
        return results.map((row) => ({
            time: row.day,
            value: Number(row.daily_value),
        }));
    }
    async getHorometro(dto) {
        const range = this.normalizeDateRange(dto);
        if (!range)
            throw new Error('Se requiere rango de fechas válido.');
        const { start, end } = range;
        const results = await this.repo.query(`
        WITH bounds AS (
          SELECT DATE(mt_time_2) AS day, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
          FROM ssr_nerquihue
          WHERE mt_name = 'SSR_NERQUIHUE--slave.horometro'
          AND mt_time_2 BETWEEN ? AND ?
          GROUP BY DATE(mt_time_2)
        )
        SELECT b.day,
          (CAST(s_last.mt_value AS DECIMAL(30,6)) - CAST(s_first.mt_value AS DECIMAL(30,6))) AS daily_value
        FROM bounds b
        LEFT JOIN ssr_nerquihue s_first
          ON s_first.mt_name = 'SSR_NERQUIHUE--slave.horometro' AND s_first.mt_time_2 = b.first_ts
        LEFT JOIN ssr_nerquihue s_last
          ON s_last.mt_name = 'SSR_NERQUIHUE--slave.horometro' AND s_last.mt_time_2 = b.last_ts
        ORDER BY b.day ASC
      `, [start, end]);
        return results.map((row) => ({
            time: row.day,
            value: Number(row.daily_value),
        }));
    }
    async getNivel(dto) {
        const range = this.normalizeDateRange(dto);
        if (!range) {
            const results = await this.repo.find({
                where: { mt_name: 'SSR_NERQUIHUE--slave.estanque' },
                order: { mt_time_2: 'DESC' },
                take: 100,
            });
            console.log(`[getNivel] Últimos 100 registros obtenidos. Rango: ${results.at(-1)?.mt_time_2?.toISOString()} → ${results[0]?.mt_time_2?.toISOString()}`);
            return results.reverse().map((row) => ({
                time: row.mt_time_2.toISOString(),
                value: Number(row.mt_value),
            }));
        }
        const { start, end } = range;
        console.log(`[getNivel] Consultando entre '${dto.start} 00:00:00' y '${dto.end} 23:59:59'`);
        const results = await this.repo.find({
            where: {
                mt_name: 'SSR_NERQUIHUE--slave.estanque',
                mt_time_2: (0, typeorm_2.Between)(start, end),
            },
            order: { mt_time_2: 'ASC' },
        });
        return results.map((row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
        }));
    }
    async getCaudal(dto) {
        const range = this.normalizeDateRange(dto);
        if (!range) {
            const results = await this.repo.find({
                where: { mt_name: 'SSR_NERQUIHUE--slave.caudal' },
                order: { mt_time_2: 'DESC' },
                take: 100,
            });
            console.log(`[getNivel] Últimos 100 registros obtenidos. Rango: ${results.at(-1)?.mt_time_2?.toISOString()} → ${results[0]?.mt_time_2?.toISOString()}`);
            return results.reverse().map((row) => ({
                time: row.mt_time_2.toISOString(),
                value: Number(row.mt_value),
            }));
        }
        const { start, end } = range;
        console.log(`[getNivel] Consultando entre '${dto.start} 00:00:00' y '${dto.end} 23:59:59'`);
        const results = await this.repo.find({
            where: {
                mt_name: 'SSR_NERQUIHUE--slave.caudal',
                mt_time_2: (0, typeorm_2.Between)(start, end),
            },
            order: { mt_time_2: 'ASC' },
        });
        return results.map((row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
        }));
    }
};
exports.SsrNerquihueService = SsrNerquihueService;
exports.SsrNerquihueService = SsrNerquihueService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metrics_entity_1.Telemetria)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SsrNerquihueService);
//# sourceMappingURL=metrics.service.js.map