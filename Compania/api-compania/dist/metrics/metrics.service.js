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
exports.SsrCompaniaService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metrics_entity_1 = require("./models/metrics.entity");
let SsrCompaniaService = class SsrCompaniaService {
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
        const results = await this.repo.query(`
    SELECT t.mt_name, t.mt_value, t.mt_time_2
    FROM ssr_compania t
    INNER JOIN (
      SELECT mt_name, MAX(mt_time_2) AS last_time
      FROM ssr_compania
      GROUP BY mt_name
    ) latest
    ON t.mt_name = latest.mt_name AND t.mt_time_2 = latest.last_time
  `);
        const snapshot = results.reduce((acc, row) => {
            const key = row.mt_name;
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
        const estanque = await calcularTiempoVaciado('SALA_BOMBAS_NIVEL_METROS');
        return {
            snapshot,
            tiempo_vaciado: estanque.tiempo,
            tiempo_vaciado_formatted: estanque.formatted,
        };
    }
    async getNivel(dto) {
        const range = this.normalizeDateRange(dto);
        if (range) {
            const { start, end } = range;
            const results = await this.repo.find({
                where: {
                    mt_name: 'SALA_BOMBAS_NIVEL_METROS',
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
            where: { mt_name: 'SALA_BOMBAS_NIVEL_METROS' },
            order: { mt_time_2: 'DESC' },
            take: takeLimit,
        });
        return results.reverse().map((row) => ({
            time: row.mt_time_2.toISOString(),
            value: Number(row.mt_value),
        }));
    }
};
exports.SsrCompaniaService = SsrCompaniaService;
exports.SsrCompaniaService = SsrCompaniaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metrics_entity_1.Telemetria)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], SsrCompaniaService);
//# sourceMappingURL=metrics.service.js.map