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
var SsrBalsasService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsrBalsasService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const sensores_config_1 = require("../config/sensores.config");
const TIME_SQL = `mt_time_2 AT TIME ZONE 'America/Santiago'`;
const VENTANA_VACIADO_MIN = 20;
const MIN_MUESTRAS_VACIADO = 5;
const BANDA_MUERTA_M_POR_MIN = 0.001;
const MAX_TIEMPO_VACIADO_SEG = 7 * 86400;
const MAX_TRAMO_HOROMETRO = `INTERVAL '5 minutes'`;
function mediana(valores) {
    if (valores.length === 0)
        return NaN;
    const ordenados = [...valores].sort((a, b) => a - b);
    const medio = Math.floor(ordenados.length / 2);
    return ordenados.length % 2
        ? ordenados[medio]
        : (ordenados[medio - 1] + ordenados[medio]) / 2;
}
function pendienteTheilSen(xs, ys) {
    const pendientes = [];
    for (let i = 0; i < xs.length; i++) {
        for (let j = i + 1; j < xs.length; j++) {
            if (xs[j] !== xs[i])
                pendientes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
        }
    }
    return mediana(pendientes);
}
function formatearDuracion(segundos) {
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    return `${String(h).padStart(2, '0')} h ${String(m).padStart(2, '0')} m ${String(s).padStart(2, '0')} s`;
}
let SsrBalsasService = SsrBalsasService_1 = class SsrBalsasService {
    db;
    config;
    logger = new common_1.Logger(SsrBalsasService_1.name);
    constructor(db, config) {
        this.db = db;
        this.config = config;
    }
    umbral(nombre, defecto) {
        const valor = Number(this.config.get(nombre));
        return Number.isFinite(valor) && valor > 0 ? valor : defecto;
    }
    async ultimasLecturas() {
        return this.db.query(`SELECT n.mt_name, u.value, u.time
       FROM unnest($1::TEXT[]) AS n(mt_name)
       CROSS JOIN LATERAL (
         SELECT mt_value AS value, ${TIME_SQL} AS time
         FROM ssr_balsas t
         WHERE t.mt_name = n.mt_name
         ORDER BY t.mt_time_2 DESC
         LIMIT 1
       ) u`, [Object.keys(sensores_config_1.NOMBRE_DE)]);
    }
    ultimoPorEquipo(filas) {
        return sensores_config_1.EQUIPOS.map((e) => {
            const tiempos = filas
                .filter((f) => f.mt_name.startsWith(`${e.equipo}--`))
                .map((f) => new Date(f.time).getTime());
            return {
                ...e,
                time: tiempos.length
                    ? new Date(Math.max(...tiempos)).toISOString()
                    : null,
            };
        });
    }
    async getSnapshot() {
        const filas = await this.ultimasLecturas();
        const snapshot = {};
        for (const fila of filas) {
            const nombre = sensores_config_1.NOMBRE_DE[fila.mt_name];
            snapshot[nombre] = {
                value: Number(fila.value) / sensores_config_1.SENSORES[nombre].divisor,
                time: new Date(fila.time).toISOString(),
            };
        }
        const corriente = snapshot[(0, sensores_config_1.variablePozo)('pozo_1', 'I1')];
        if (corriente) {
            snapshot.pozo_1_bomba = {
                value: corriente.value > sensores_config_1.UMBRAL_CORRIENTE_A ? 1 : 0,
                time: corriente.time,
            };
        }
        return {
            snapshot,
            equipos: this.ultimoPorEquipo(filas),
            tiempo_vaciado: await this.calcularTiempoVaciado(),
            nivel_alerta: this.umbral('NIVEL_ALERTA', 2),
            nivel_maximo: this.umbral('NIVEL_MAXIMO', 5),
        };
    }
    async getEquipos() {
        const equipos = this.ultimoPorEquipo(await this.ultimasLecturas());
        const snapshot = {};
        for (const e of equipos) {
            snapshot[`${e.nombre} (${e.equipo})`] = { time: e.time };
        }
        return { snapshot };
    }
    async calcularTiempoVaciado() {
        const { mtName, divisor } = sensores_config_1.SENSORES.estanque;
        const filas = await this.db.query(`SELECT mt_value AS value, ${TIME_SQL} AS time
       FROM ssr_balsas
       WHERE mt_name = $1
         AND mt_time_2 >= (SELECT MAX(mt_time_2) FROM ssr_balsas WHERE mt_name = $1)
                          - make_interval(mins => $2)
       ORDER BY mt_time_2`, [mtName, VENTANA_VACIADO_MIN]);
        if (filas.length < MIN_MUESTRAS_VACIADO)
            return { tiempo: 0, formatted: 'Sin datos', tendencia: 'sin_datos' };
        const xs = filas.map((f) => new Date(f.time).getTime() / 1000);
        const ys = filas.map((f) => Number(f.value) / divisor);
        const pendiente = pendienteTheilSen(xs, ys);
        if (Math.abs(pendiente) * 60 < BANDA_MUERTA_M_POR_MIN)
            return { tiempo: 0, formatted: 'Estable', tendencia: 'estable' };
        if (pendiente > 0)
            return { tiempo: 0, formatted: 'Llenando...', tendencia: 'llenado' };
        const intercepto = mediana(ys.map((y, i) => y - pendiente * xs[i]));
        const nivelActual = intercepto + pendiente * xs[xs.length - 1];
        const tiempo = Math.round(nivelActual / -pendiente);
        return {
            tiempo,
            formatted: tiempo > MAX_TIEMPO_VACIADO_SEG
                ? 'Más de 7 días'
                : formatearDuracion(tiempo),
            tendencia: 'vaciado',
        };
    }
    async serie(nombre, dto) {
        const { mtName, divisor } = sensores_config_1.SENSORES[nombre];
        const aMetrica = (fila) => ({
            time: new Date(fila.time).toISOString(),
            value: Number(fila.value) / divisor,
        });
        if (dto.start && dto.end) {
            const filas = await this.db.query(`SELECT mt_value AS value, ${TIME_SQL} AS time
         FROM ssr_balsas
         WHERE mt_name = $1 AND mt_time_2 >= $2::DATE AND mt_time_2 < $3::DATE + 1
         ORDER BY mt_time_2`, [mtName, dto.start, dto.end]);
            return filas.map(aMetrica);
        }
        const filas = await this.db.query(`SELECT mt_value AS value, ${TIME_SQL} AS time
       FROM ssr_balsas
       WHERE mt_name = $1
       ORDER BY mt_time_2 DESC
       LIMIT $2`, [mtName, dto.limit ?? 100]);
        return filas.reverse().map(aMetrica);
    }
    async seriesPozo(pozo, variables, dto) {
        const series = await Promise.all(variables.map((v) => this.serie((0, sensores_config_1.variablePozo)(pozo, v), dto)));
        return Object.fromEntries(variables.map((v, i) => [v, series[i]]));
    }
    exigirRango(dto) {
        if (!dto.start || !dto.end)
            throw new common_1.BadRequestException('start y end son obligatorios');
        return { start: dto.start, end: dto.end };
    }
    async totalDiario(nombre, dto) {
        const { start, end } = this.exigirRango(dto);
        const { mtName, divisor } = sensores_config_1.SENSORES[nombre];
        const filas = await this.db.query(`WITH dias AS (
         SELECT d::DATE AS dia FROM generate_series($2::DATE, $3::DATE, INTERVAL '1 day') d
       )
       SELECT dias.dia::TEXT AS dia,
              GREATEST(ultimo.v - primero.v, 0) AS valor
       FROM dias
       CROSS JOIN LATERAL (
         SELECT mt_value::NUMERIC AS v FROM ssr_balsas
         WHERE mt_name = $1 AND mt_time_2 >= dias.dia AND mt_time_2 < dias.dia + 1
         ORDER BY mt_time_2 ASC LIMIT 1
       ) primero
       CROSS JOIN LATERAL (
         SELECT mt_value::NUMERIC AS v FROM ssr_balsas
         WHERE mt_name = $1 AND mt_time_2 >= dias.dia AND mt_time_2 < dias.dia + 1
         ORDER BY mt_time_2 DESC LIMIT 1
       ) ultimo
       ORDER BY dias.dia`, [mtName, start, end]);
        return filas.map((f) => ({
            time: f.dia,
            value: Number(f.valor ?? 0) / divisor,
        }));
    }
    getTotalizador(dto) {
        return this.totalDiario('totalizador', dto);
    }
    getTotalizadorDescarga(dto) {
        return this.totalDiario('totalizador_descarga', dto);
    }
    async getHorometro(dto) {
        const { start, end } = this.exigirRango(dto);
        const { mtName, divisor } = sensores_config_1.SENSORES[(0, sensores_config_1.variablePozo)(dto.pozo, 'I1')];
        const filas = await this.db.query(`WITH muestras AS (
         SELECT mt_time_2 AS ts,
                mt_value::NUMERIC AS corriente,
                LEAD(mt_time_2) OVER (ORDER BY mt_time_2) AS siguiente
         FROM ssr_balsas
         WHERE mt_name = $1
           AND mt_time_2 >= $2::DATE - 1
           AND mt_time_2 < $3::DATE + 2
       ),
       dias AS (
         SELECT d::TIMESTAMP AS inicio FROM generate_series($2::DATE, $3::DATE, INTERVAL '1 day') d
       )
       SELECT dias.inicio::DATE::TEXT AS dia,
              ROUND(EXTRACT(EPOCH FROM COALESCE(SUM(GREATEST(
                LEAST(m.siguiente, m.ts + ${MAX_TRAMO_HOROMETRO}, dias.inicio + INTERVAL '1 day')
                  - GREATEST(m.ts, dias.inicio),
                INTERVAL '0'
              )) FILTER (WHERE m.corriente > $4), INTERVAL '0'))::NUMERIC / 60, 2) AS valor
       FROM dias
       JOIN muestras m
         ON m.siguiente > dias.inicio AND m.ts < dias.inicio + INTERVAL '1 day'
       GROUP BY dias.inicio
       ORDER BY dias.inicio`, [mtName, start, end, sensores_config_1.UMBRAL_CORRIENTE_A * divisor]);
        return filas.map((f) => ({ time: f.dia, value: Number(f.valor ?? 0) }));
    }
    getNivel(dto) {
        return this.serie('estanque', dto);
    }
    getCaudal(dto) {
        return this.serie('caudal', dto);
    }
    getPresion(dto) {
        return this.serie('presion', dto);
    }
    getCaudalDescarga(dto) {
        return this.serie('caudal_descarga', dto);
    }
    getSolar(dto) {
        return this.serie('solar', dto);
    }
    getVoltaje(dto) {
        return this.seriesPozo(dto.pozo, sensores_config_1.VARIABLES_VOLTAJE[dto.tipo ?? 'linea'], dto);
    }
    getCorriente(dto) {
        return this.seriesPozo(dto.pozo, sensores_config_1.VARIABLES_CORRIENTE, dto);
    }
};
exports.SsrBalsasService = SsrBalsasService;
exports.SsrBalsasService = SsrBalsasService = SsrBalsasService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        config_1.ConfigService])
], SsrBalsasService);
//# sourceMappingURL=metrics.service.js.map