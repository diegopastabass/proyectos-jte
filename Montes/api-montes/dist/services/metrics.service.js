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
var MetricsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = exports.SENSORES = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metric_entity_1 = require("../models/metric.entity");
exports.SENSORES = {
    caudal: ['montes_riles_caudal', 'montes_general_caudal'],
    totalizador: ['montes_riles_totalizador', 'montes_general_totalizador'],
};
const hoyChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
const sumarDias = (dia, n) => {
    const d = new Date(`${dia}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const listarDias = (desde, hasta) => {
    const dias = [];
    for (let d = desde; d <= hasta; d = sumarDias(d, 1))
        dias.push(d);
    return dias;
};
let MetricsService = MetricsService_1 = class MetricsService {
    metricRepository;
    logger = new common_1.Logger(MetricsService_1.name);
    maxM3h;
    maxHorasLectura;
    tablaDiariaDisponible = true;
    constructor(metricRepository, config) {
        this.metricRepository = metricRepository;
        this.maxM3h = Number(config.get('TOTALIZADOR_MAX_M3H') ?? 200);
        this.maxHorasLectura =
            Number(config.get('INTERVALO_MAX_MINUTOS') ?? 15) / 60;
    }
    validarSensor(name, tipo) {
        if (!exports.SENSORES[tipo].includes(name)) {
            throw new common_1.NotFoundException(`Sensor de ${tipo} desconocido: ${name}`);
        }
    }
    validarRango(start, end) {
        if (!start && !end)
            return false;
        if (!start || !end) {
            throw new common_1.BadRequestException('Se requieren start y end juntos');
        }
        if (start > end) {
            throw new common_1.BadRequestException('start debe ser anterior o igual a end');
        }
        return true;
    }
    async findLatestForEachName() {
        const metrics = await this.metricRepository
            .createQueryBuilder('metric')
            .distinctOn(['metric.name'])
            .orderBy('metric.name')
            .addOrderBy('metric.time', 'DESC')
            .addOrderBy('metric.id', 'DESC')
            .getMany();
        const result = {};
        metrics.forEach((metric) => {
            result[metric.name] = {
                value: Number(metric.value),
                time: metric.time,
            };
        });
        return result;
    }
    async getFlowRate(name, start, end) {
        this.validarSensor(name, 'caudal');
        const conRango = this.validarRango(start, end);
        const filtro = conRango
            ? 'time >= $2::date AND time < $3::date + 1'
            : "time >= now() - INTERVAL '24 hours'";
        const rows = await this.metricRepository.query(`SELECT time, value::float8 AS value
         FROM montes
         WHERE name = $1 AND ${filtro}
         ORDER BY id`, conRango ? [name, start, end] : [name]);
        return rows.map((r) => ({ value: Number(r.value), time: r.time.toISOString() }));
    }
    async getDailyTotalizer(name, start, end) {
        this.validarSensor(name, 'totalizador');
        const hoy = hoyChile();
        const conRango = this.validarRango(start, end);
        return this.diario(name, listarDias(conRango ? start : sumarDias(hoy, -14), conRango ? end : hoy));
    }
    async getMonthlyTotalizer(name, meses = 12) {
        this.validarSensor(name, 'totalizador');
        const hoy = hoyChile();
        const inicio = new Date(`${hoy.slice(0, 7)}-01T00:00:00Z`);
        inicio.setUTCMonth(inicio.getUTCMonth() - (meses - 1));
        const dias = await this.diario(name, listarDias(inicio.toISOString().slice(0, 10), hoy));
        const porMes = new Map();
        for (const d of dias) {
            const mes = d.time.slice(0, 7);
            porMes.set(mes, (porMes.get(mes) ?? 0) + d.value);
        }
        return [...porMes].map(([time, value]) => ({ time, value }));
    }
    async getHourlyTotalizer(name, start, end) {
        this.validarSensor(name, 'totalizador');
        const conRango = this.validarRango(start, end);
        const desde = conRango ? '$2::date' : "now() - INTERVAL '24 hours'";
        const hasta = conRango ? '$3::date + 1' : 'now()';
        const pmax = conRango ? '$4' : '$2';
        const rows = await this.metricRepository.query(`WITH s AS (
         SELECT time, value::float8 AS v,
                LAG(value::float8) OVER (ORDER BY id) AS prev,
                LAG(time) OVER (ORDER BY id) AS prev_time
         FROM montes
         WHERE name = $1 AND time >= ${desde} - INTERVAL '1 day' AND time < ${hasta}
       )
       SELECT date_trunc('hour', time) AS hora,
              COALESCE(SUM(v - prev) FILTER (
                WHERE v > prev
                  AND v - prev <= ${pmax} * GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0.25)
              ), 0) AS valor
       FROM s
       WHERE time >= ${desde} AND prev IS NOT NULL
       GROUP BY 1
       ORDER BY 1`, conRango ? [name, start, end, this.maxM3h] : [name, this.maxM3h]);
        return rows.map((r) => ({ value: Number(r.valor), time: r.hora.toISOString() }));
    }
    async getHourlyVolumeFromFlow(name, start, end) {
        this.validarSensor(name, 'caudal');
        const conRango = this.validarRango(start, end);
        const desde = conRango ? '$2::date' : "now() - INTERVAL '24 hours'";
        const hasta = conRango ? '$3::date + 1' : 'now()';
        const pmax = conRango ? '$4' : '$2';
        const rows = await this.metricRepository.query(`WITH s AS (
         SELECT time, value::float8 AS v, LAG(time) OVER (ORDER BY id) AS prev_time
         FROM montes
         WHERE name = $1 AND time >= ${desde} - INTERVAL '1 hour' AND time < ${hasta}
       )
       SELECT date_trunc('hour', time) AS hora,
              SUM(v * LEAST(GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0), ${pmax})) AS valor
       FROM s
       WHERE time >= ${desde} AND prev_time IS NOT NULL
       GROUP BY 1
       ORDER BY 1`, conRango
            ? [name, start, end, this.maxHorasLectura]
            : [name, this.maxHorasLectura]);
        return rows.map((r) => ({ value: Number(r.valor), time: r.hora.toISOString() }));
    }
    async diario(name, dias) {
        const hoy = hoyChile();
        const valores = new Map();
        if (this.tablaDiariaDisponible) {
            try {
                const cacheadas = await this.metricRepository.query(`SELECT mt_day::text AS dia, mt_value AS valor
           FROM montes_daily_metrics
           WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`, [name, dias[0], dias[dias.length - 1]]);
                cacheadas.forEach((f) => valores.set(f.dia, f.valor === null ? null : Number(f.valor)));
            }
            catch (error) {
                this.desactivarTablaDiaria(error);
            }
        }
        const pendientes = dias.filter((d) => d === hoy || !valores.has(d));
        if (pendientes.length > 0) {
            const calculadas = await this.consumoPorDia(name, pendientes[0], pendientes[pendientes.length - 1]);
            const aGuardar = pendientes.filter((d) => d < hoy);
            pendientes.forEach((d) => valores.set(d, calculadas.get(d) ?? null));
            if (this.tablaDiariaDisponible && aGuardar.length > 0) {
                try {
                    await this.metricRepository.query(`INSERT INTO montes_daily_metrics (mt_name, mt_day, mt_value)
             SELECT $1, t.dia::date, t.valor
             FROM unnest($2::text[], $3::float8[]) AS t(dia, valor)
             ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`, [name, aGuardar, aGuardar.map((d) => calculadas.get(d) ?? null)]);
                }
                catch (error) {
                    this.desactivarTablaDiaria(error);
                }
            }
        }
        return dias
            .filter((d) => valores.get(d) != null)
            .map((d) => ({ time: d, value: valores.get(d) }));
    }
    async consumoPorDia(name, desde, hasta) {
        const filas = await this.metricRepository.query(`WITH s AS (
         SELECT time, value::float8 AS v,
                LAG(value::float8) OVER (ORDER BY id) AS prev,
                LAG(time) OVER (ORDER BY id) AS prev_time
         FROM montes
         WHERE name = $1 AND time >= $2::date - 1 AND time < $3::date + 1
       )
       SELECT time::date::text AS dia,
              COALESCE(SUM(v - prev) FILTER (
                WHERE v > prev
                  AND v - prev <= $4 * GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0.25)
              ), 0) AS valor
       FROM s
       WHERE time >= $2::date AND prev IS NOT NULL
       GROUP BY 1`, [name, desde, hasta, this.maxM3h]);
        return new Map(filas.map((f) => [f.dia, Number(f.valor ?? 0)]));
    }
    desactivarTablaDiaria(error) {
        if (error?.code === '42P01') {
            this.tablaDiariaDisponible = false;
            this.logger.warn('No existe montes_daily_metrics: el consumo diario se calcula sin caché. Ejecutar migrations/001-mejoras-2026-11.sql');
            return;
        }
        throw error;
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = MetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metric_entity_1.Metric)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map