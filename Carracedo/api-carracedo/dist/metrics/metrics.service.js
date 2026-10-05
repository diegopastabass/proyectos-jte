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
exports.CarracedoService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metrics_entity_1 = require("./models/metrics.entity");
const formatDBDate = (date) => {
    const d = new Date(date);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
};
let CarracedoService = class CarracedoService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async getSnapshot() {
        const results = await this.repo.query(`
      SELECT t.mt_name, t.mt_value, t.mt_time_2
      FROM carracedo t
      INNER JOIN (
        SELECT mt_name, MAX(mt_time_2) AS last_time
        FROM carracedo
        GROUP BY mt_name
      ) latest
      ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
    `);
        const prefix = 'CARRACEDO--slave.';
        return results.reduce((acc, row) => {
            const key = row.mt_name.replace(prefix, '');
            acc[key] = {
                value: Number(row.mt_value),
                time: formatDBDate(row.mt_time_2),
            };
            return acc;
        }, {});
    }
    async getTotalizador(dto) {
        if (!dto.start || !dto.end)
            throw new Error('Se requiere rango de fechas válido.');
        const start = `${dto.start} 00:00:00`;
        const end = `${dto.end} 23:59:59`;
        const results = await this.repo.query(`
        WITH bounds AS (
          SELECT 
            mt_time_2::DATE AS day, 
            MIN(mt_time_2) AS first_ts, 
            MAX(mt_time_2) AS last_ts
          FROM carracedo
          WHERE mt_name = 'CARRACEDO--slave.totalizador'
          AND mt_time_2 BETWEEN $1 AND $2
          GROUP BY mt_time_2::DATE
        )
        SELECT 
          b.day,
          (
            (SELECT CAST(mt_value AS NUMERIC(30,6)) FROM carracedo WHERE mt_name = 'CARRACEDO--slave.totalizador' AND mt_time_2 = b.last_ts LIMIT 1)
            -
            (SELECT CAST(mt_value AS NUMERIC(30,6)) FROM carracedo WHERE mt_name = 'CARRACEDO--slave.totalizador' AND mt_time_2 = b.first_ts LIMIT 1)
          ) AS daily_value
        FROM bounds b
        ORDER BY b.day ASC
      `, [start, end]);
        return results.map((row) => {
            const dateStr = row.day instanceof Date
                ? row.day.toISOString().split('T')[0]
                : String(row.day);
            return {
                time: dateStr,
                value: Number(row.daily_value || 0),
            };
        });
    }
    async getNivel(dto) {
        const hasRange = dto.start && dto.end;
        if (hasRange) {
            const start = new Date(`${dto.start}T00:00:00`);
            const end = new Date(`${dto.end}T23:59:59`);
            const results = await this.repo.find({
                where: {
                    mt_name: 'CARRACEDO--slave.pozo',
                    mt_time_2: (0, typeorm_2.Between)(start, end),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((row) => ({
                time: formatDBDate(row.mt_time_2),
                value: Number(row.mt_value),
            }));
        }
        const results = await this.repo.find({
            where: { mt_name: 'CARRACEDO--slave.pozo' },
            order: { mt_time_2: 'DESC' },
            take: 300,
        });
        return results.reverse().map((row) => ({
            time: formatDBDate(row.mt_time_2),
            value: Number(row.mt_value),
        }));
    }
    async getCaudal(dto) {
        const hasRange = dto.start && dto.end;
        if (hasRange) {
            const start = new Date(`${dto.start}T00:00:00`);
            const end = new Date(`${dto.end}T23:59:59`);
            const results = await this.repo.find({
                where: {
                    mt_name: 'CARRACEDO--slave.caudal',
                    mt_time_2: (0, typeorm_2.Between)(start, end),
                },
                order: { mt_time_2: 'ASC' },
            });
            return results.map((row) => ({
                time: formatDBDate(row.mt_time_2),
                value: Number(row.mt_value),
            }));
        }
        const results = await this.repo.find({
            where: { mt_name: 'CARRACEDO--slave.caudal' },
            order: { mt_time_2: 'DESC' },
            take: 300,
        });
        return results.reverse().map((row) => ({
            time: formatDBDate(row.mt_time_2),
            value: Number(row.mt_value),
        }));
    }
};
exports.CarracedoService = CarracedoService;
exports.CarracedoService = CarracedoService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metrics_entity_1.Telemetria)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], CarracedoService);
//# sourceMappingURL=metrics.service.js.map