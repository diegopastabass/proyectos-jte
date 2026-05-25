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
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const metric_entity_1 = require("../models/metric.entity");
let MetricsService = MetricsService_1 = class MetricsService {
    constructor(metricRepository) {
        this.metricRepository = metricRepository;
        this.logger = new common_1.Logger(MetricsService_1.name);
        this.metricsBuffer = [];
    }
    onModuleInit() {
        this.flushInterval = setInterval(() => {
            this.flushMetrics();
        }, 120000);
    }
    onModuleDestroy() {
        clearInterval(this.flushInterval);
        this.flushMetrics();
    }
    async createMetric(dto) {
        this.metricsBuffer.push(dto);
        if (this.metricsBuffer.length >= 100) {
            await this.flushMetrics();
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
                .into('viveros_tambo')
                .values(dataToSave)
                .execute();
            this.logger.log(`Bulk inserted ${dataToSave.length} metrics`);
        }
        catch (error) {
            this.logger.error('Error in bulk insert', error);
        }
    }
    static calculateVPD(tempC, humidity) {
        const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
        const avp = svp * (humidity / 100);
        const vpd = svp - avp;
        return Math.round(vpd * 100) / 100;
    }
    async findLatestForEachSensor() {
        try {
            const subQuery = this.metricRepository
                .createQueryBuilder('m1')
                .select('m1.sensor_id', 'sensor_id')
                .addSelect('MAX(m1.time)', 'max_time')
                .groupBy('m1.sensor_id');
            const query = this.metricRepository
                .createQueryBuilder('m')
                .select([
                'm.sensor_id AS sensor_id',
                'm.value AS value',
                'm.time AS time',
            ])
                .innerJoin(`(${subQuery.getQuery()})`, 'sub', 'm.sensor_id = sub.sensor_id AND m.time = sub.max_time')
                .setParameters(subQuery.getParameters());
            const results = await query.getRawMany();
            const mappedResults = results.reduce((acc, row) => {
                acc[row.sensor_id] = {
                    value: row.value,
                    time: row.time,
                };
                return acc;
            }, {});
            if (mappedResults['5'] && mappedResults['3']) {
                mappedResults.vpd_calor = MetricsService_1.calculateVPD(Number(mappedResults['5'].value), Number(mappedResults['3'].value));
            }
            if (mappedResults['6'] && mappedResults['4']) {
                mappedResults.vpd_frio = MetricsService_1.calculateVPD(Number(mappedResults['6'].value), Number(mappedResults['4'].value));
            }
            if (mappedResults['7'] && mappedResults['8']) {
                mappedResults.vpd_ambiente = MetricsService_1.calculateVPD(Number(mappedResults['7'].value), Number(mappedResults['8'].value));
            }
            this.logger.log(`Retrieved latest metrics for each sensor, count: ${results.length}`);
            return mappedResults;
        }
        catch (error) {
            this.logger.error('Error retrieving latest metrics', error.stack);
            throw new common_1.InternalServerErrorException('Error retrieving latest metrics');
        }
    }
    async findMetricsBySensorsAndDateRange(startDate, endDate) {
        try {
            const startDateTime = new Date(`${startDate}T00:00:00`);
            const endDateTime = new Date(`${endDate}T23:59:59`);
            const results = await this.metricRepository
                .createQueryBuilder('m')
                .where('m.sensor_id IN (:...sensorIds)', { sensorIds: [3, 4, 5, 6] })
                .andWhere('m.time BETWEEN :startDate AND :endDate', {
                startDate: startDateTime,
                endDate: endDateTime,
            })
                .orderBy('m.time', 'ASC')
                .getMany();
            const grouped = results.reduce((acc, row) => {
                if (!acc[row.sensor_id]) {
                    acc[row.sensor_id] = [];
                }
                acc[row.sensor_id].push({
                    value: row.value,
                    time: row.time,
                });
                return acc;
            }, {});
            this.logger.log(`Retrieved metrics grouped by sensor between ${startDateTime.toISOString()} and ${endDateTime.toISOString()}`);
            return grouped;
        }
        catch (error) {
            this.logger.error('Error retrieving metrics by sensors and date range', error.stack);
            throw new common_1.InternalServerErrorException('Error retrieving metrics by sensors and date range');
        }
    }
    async findChartData() {
        try {
            const sensorIds = [3, 4, 5, 6];
            const grouped = {};
            sensorIds.forEach((id) => (grouped[id.toString()] = []));
            for (const sensorId of sensorIds) {
                const results = await this.metricRepository
                    .createQueryBuilder('m')
                    .where('m.sensor_id = :sensorId', { sensorId })
                    .orderBy('m.time', 'DESC')
                    .limit(100)
                    .getMany();
                grouped[sensorId.toString()] = results
                    .map((r) => ({ value: r.value, time: r.time }))
                    .sort((a, b) => a.time.getTime() - b.time.getTime());
            }
            this.logger.log(`Retrieved last 100 metrics for sensors ${sensorIds.join(', ')}`);
            return grouped;
        }
        catch (error) {
            this.logger.error('Error retrieving chart data', error.stack);
            throw new common_1.InternalServerErrorException('Error retrieving chart data');
        }
    }
    async getViverosDataForExcel(fechaInicio, fechaFin) {
        try {
            const startDateTime = new Date(`${fechaInicio}T00:00:00`);
            const endDateTime = new Date(`${fechaFin}T23:59:59`);
            const results = await this.metricRepository.query(`
          SELECT id, sensor_name, value, time
          FROM viveros_tambo_view
          WHERE time BETWEEN $1 AND $2
          ORDER BY time DESC
        `, [startDateTime, endDateTime]);
            this.logger.log(`Retrieved viveros data for Excel between ${startDateTime.toISOString()} and ${endDateTime.toISOString()}`);
            return results.map((row) => ({
                id: row.id,
                sensor_name: row.sensor_name,
                value: Number(row.value),
                time: new Date(row.time),
            }));
        }
        catch (error) {
            this.logger.error('Error retrieving viveros data for Excel', error.stack);
            throw new common_1.InternalServerErrorException('Error retrieving viveros data for Excel');
        }
    }
    async getMinMax(date) {
        try {
            const startDateTime = new Date(`${date}T00:00:00`);
            const endDateTime = new Date(`${date}T23:59:59`);
            const sensorIds = [3, 4, 5, 6];
            const results = await this.metricRepository
                .createQueryBuilder('m')
                .select('m.sensor_id', 'sensor_id')
                .addSelect('MIN(m.value)', 'min')
                .addSelect('MAX(m.value)', 'max')
                .where('m.sensor_id IN (:...sensorIds)', { sensorIds })
                .andWhere('m.time BETWEEN :startDate AND :endDate', {
                startDate: startDateTime,
                endDate: endDateTime,
            })
                .groupBy('m.sensor_id')
                .getRawMany();
            const mapped = results.reduce((acc, row) => {
                acc[row.sensor_id] = {
                    min: Number(row.min),
                    max: Number(row.max),
                };
                return acc;
            }, {});
            this.logger.log(`Retrieved min/max metrics for sensors ${sensorIds.join(', ')} on ${date}`);
            return mapped;
        }
        catch (error) {
            this.logger.error('Error retrieving min/max metrics', error.stack);
            throw new common_1.InternalServerErrorException('Error retrieving min/max metrics');
        }
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = MetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metric_entity_1.Metric)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map