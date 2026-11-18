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
    caudal: [1, 2],
    totalizador: [3, 4, 5],
};
const SENSORES_SNAPSHOT = [...exports.SENSORES.caudal, ...exports.SENSORES.totalizador];
const TZ = `'America/Santiago'`;
const inicioDia = (param) => `(${param}::date)::timestamp AT TIME ZONE ${TZ}`;
const finDia = (param) => `(${param}::date + 1)::timestamp AT TIME ZONE ${TZ}`;
const diaLocal = `(time AT TIME ZONE ${TZ})::date`;
const horaLocal = `date_trunc('hour', time AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ}`;
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
const MS_DUPLICADO = 5000;
let MetricsService = MetricsService_1 = class MetricsService {
    constructor(metricRepository, config) {
        this.metricRepository = metricRepository;
        this.logger = new common_1.Logger(MetricsService_1.name);
        this.metricsBuffer = [];
        this.tablaDiariaDisponible = true;
        this.maxM3h = Number(config.get('TOTALIZADOR_MAX_M3H') ?? 500);
        this.maxHorasLectura =
            Number(config.get('INTERVALO_MAX_MINUTOS') ?? 15) / 60;
    }
    onModuleInit() {
        this.flushInterval = setInterval(() => {
            void this.flushMetrics();
        }, 30000);
    }
    async onModuleDestroy() {
        clearInterval(this.flushInterval);
        await this.flushMetrics();
    }
    createMetric(dto) {
        if (!dto.sensor_id || dto.value === undefined || dto.value === null) {
            throw new Error('Debe proporcionar sensor_id y value para insertar un nuevo registro.');
        }
        const ahora = new Date();
        const repetida = this.metricsBuffer.some((m) => m.sensor_id === dto.sensor_id &&
            m.value === dto.value &&
            ahora.getTime() - m.time.getTime() < MS_DUPLICADO);
        if (!repetida) {
            this.metricsBuffer.push({ ...dto, time: ahora });
            if (this.metricsBuffer.length >= 100) {
                void this.flushMetrics();
            }
        }
        return { success: true, message: 'Metric buffered' };
    }
    async flushMetrics() {
        if (this.metricsBuffer.length === 0)
            return;
        const dataToSave = [...this.metricsBuffer];
        this.metricsBuffer = [];
        try {
            await this.metricRepository
                .createQueryBuilder()
                .insert()
                .into(metric_entity_1.Metric)
                .values(dataToSave)
                .execute();
            this.logger.log(`Bulk inserted ${dataToSave.length} metrics for Undurraga`);
        }
        catch (error) {
            this.logger.error('Error in bulk insert', error);
        }
    }
    validarSensor(sensor, tipo) {
        if (!exports.SENSORES[tipo].includes(sensor)) {
            throw new common_1.NotFoundException(`Sensor de ${tipo} desconocido: ${sensor}`);
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
    async getSnapshot() {
        const rows = await this.metricRepository.query(`SELECT DISTINCT ON (sensor_id) sensor_id, value, time
         FROM undurraga_metrics
         WHERE sensor_id = ANY($1::int[])
         ORDER BY sensor_id, time DESC, id DESC`, [SENSORES_SNAPSHOT]);
        const resultado = {};
        rows.forEach((r) => {
            resultado[r.sensor_id] = {
                value: Number(r.value),
                time: r.time.toISOString(),
            };
        });
        return resultado;
    }
    async getCaudal(sensor, start, end) {
        this.validarSensor(sensor, 'caudal');
        const conRango = this.validarRango(start, end);
        const filtro = conRango
            ? `time >= ${inicioDia('$2')} AND time < ${finDia('$3')}`
            : "time >= now() - INTERVAL '24 hours'";
        const rows = await this.metricRepository.query(`SELECT time, value
         FROM undurraga_metrics
         WHERE sensor_id = $1 AND ${filtro}
         ORDER BY time, id`, conRango ? [sensor, start, end] : [sensor]);
        return rows.map((r) => ({ value: Number(r.value), time: r.time.toISOString() }));
    }
    async getDailyTotalizer(sensor, start, end) {
        this.validarSensor(sensor, 'totalizador');
        const hoy = hoyChile();
        const conRango = this.validarRango(start, end);
        return this.diario(sensor, listarDias(conRango ? start : sumarDias(hoy, -14), conRango ? end : hoy));
    }
    async getMonthlyTotalizer(sensor, meses = 12) {
        this.validarSensor(sensor, 'totalizador');
        const hoy = hoyChile();
        const inicio = new Date(`${hoy.slice(0, 7)}-01T00:00:00Z`);
        inicio.setUTCMonth(inicio.getUTCMonth() - (meses - 1));
        const dias = await this.diario(sensor, listarDias(inicio.toISOString().slice(0, 10), hoy));
        const porMes = new Map();
        for (const d of dias) {
            const mes = d.time.slice(0, 7);
            porMes.set(mes, (porMes.get(mes) ?? 0) + d.value);
        }
        return [...porMes].map(([time, value]) => ({ time, value }));
    }
    async getHourlyTotalizer(sensor, start, end) {
        this.validarSensor(sensor, 'totalizador');
        const conRango = this.validarRango(start, end);
        const desde = conRango ? inicioDia('$2') : "now() - INTERVAL '24 hours'";
        const hasta = conRango ? finDia('$3') : 'now()';
        const pmax = conRango ? '$4' : '$2';
        const rows = await this.metricRepository.query(`WITH s AS (
         SELECT time, value::float8 AS v,
                LAG(value::float8) OVER (ORDER BY time, id) AS prev,
                LAG(time) OVER (ORDER BY time, id) AS prev_time
         FROM undurraga_metrics
         WHERE sensor_id = $1 AND time >= ${desde} - INTERVAL '1 day' AND time < ${hasta}
       )
       SELECT ${horaLocal} AS hora,
              COALESCE(SUM(v - prev) FILTER (
                WHERE v > prev
                  AND v - prev <= ${pmax} * GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0.25)
              ), 0) AS valor
       FROM s
       WHERE time >= ${desde} AND prev IS NOT NULL
       GROUP BY 1
       ORDER BY 1`, conRango ? [sensor, start, end, this.maxM3h] : [sensor, this.maxM3h]);
        return rows.map((r) => ({ value: Number(r.valor), time: r.hora.toISOString() }));
    }
    async getHourlyVolumeFromFlow(sensor, start, end) {
        this.validarSensor(sensor, 'caudal');
        const conRango = this.validarRango(start, end);
        const desde = conRango ? inicioDia('$2') : "now() - INTERVAL '24 hours'";
        const hasta = conRango ? finDia('$3') : 'now()';
        const pmax = conRango ? '$4' : '$2';
        const rows = await this.metricRepository.query(`WITH s AS (
         SELECT time, value::float8 AS v, LAG(time) OVER (ORDER BY time, id) AS prev_time
         FROM undurraga_metrics
         WHERE sensor_id = $1 AND time >= ${desde} - INTERVAL '1 hour' AND time < ${hasta}
       )
       SELECT ${horaLocal} AS hora,
              SUM(v * LEAST(GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0), ${pmax})) AS valor
       FROM s
       WHERE time >= ${desde} AND prev_time IS NOT NULL
       GROUP BY 1
       ORDER BY 1`, conRango
            ? [sensor, start, end, this.maxHorasLectura]
            : [sensor, this.maxHorasLectura]);
        return rows.map((r) => ({ value: Number(r.valor), time: r.hora.toISOString() }));
    }
    async diario(sensor, dias) {
        const hoy = hoyChile();
        const valores = new Map();
        if (this.tablaDiariaDisponible) {
            try {
                const cacheadas = await this.metricRepository.query(`SELECT mt_day::text AS dia, mt_value AS valor
           FROM undurraga_daily_metrics
           WHERE sensor_id = $1 AND mt_day BETWEEN $2 AND $3`, [sensor, dias[0], dias[dias.length - 1]]);
                cacheadas.forEach((f) => valores.set(f.dia, f.valor === null ? null : Number(f.valor)));
            }
            catch (error) {
                this.desactivarTablaDiaria(error);
            }
        }
        const pendientes = dias.filter((d) => d === hoy || !valores.has(d));
        if (pendientes.length > 0) {
            const calculadas = await this.consumoPorDia(sensor, pendientes[0], pendientes[pendientes.length - 1]);
            const aGuardar = pendientes.filter((d) => d < hoy);
            pendientes.forEach((d) => valores.set(d, calculadas.get(d) ?? null));
            if (this.tablaDiariaDisponible && aGuardar.length > 0) {
                try {
                    await this.metricRepository.query(`INSERT INTO undurraga_daily_metrics (sensor_id, mt_day, mt_value)
             SELECT $1, t.dia::date, t.valor
             FROM unnest($2::text[], $3::float8[]) AS t(dia, valor)
             ON CONFLICT (sensor_id, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`, [sensor, aGuardar, aGuardar.map((d) => calculadas.get(d) ?? null)]);
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
    async consumoPorDia(sensor, desde, hasta) {
        const filas = await this.metricRepository.query(`WITH s AS (
         SELECT time, value::float8 AS v,
                LAG(value::float8) OVER (ORDER BY time, id) AS prev,
                LAG(time) OVER (ORDER BY time, id) AS prev_time
         FROM undurraga_metrics
         WHERE sensor_id = $1
           AND time >= ${inicioDia('$2')} - INTERVAL '1 day'
           AND time < ${finDia('$3')}
       )
       SELECT ${diaLocal}::text AS dia,
              COALESCE(SUM(v - prev) FILTER (
                WHERE v > prev
                  AND v - prev <= $4 * GREATEST(EXTRACT(EPOCH FROM time - prev_time) / 3600, 0.25)
              ), 0) AS valor
       FROM s
       WHERE time >= ${inicioDia('$2')} AND prev IS NOT NULL
       GROUP BY 1`, [sensor, desde, hasta, this.maxM3h]);
        return new Map(filas.map((f) => [f.dia, Number(f.valor ?? 0)]));
    }
    desactivarTablaDiaria(error) {
        if (error?.code === '42P01') {
            this.tablaDiariaDisponible = false;
            this.logger.warn('No existe undurraga_daily_metrics: el consumo diario se calcula sin caché. Ejecutar migrations/001-mejoras-2026-11.sql');
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