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
    metricRepository;
    logger = new common_1.Logger(MetricsService_1.name);
    metricsBuffer = [];
    flushInterval;
    constructor(metricRepository) {
        this.metricRepository = metricRepository;
    }
    onModuleInit() {
        this.flushInterval = setInterval(() => {
            this.flushMetrics();
        }, 60000);
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
                .into('montes')
                .values(dataToSave)
                .execute();
            this.logger.log(`Bulk inserted ${dataToSave.length} metrics`);
        }
        catch (error) {
            this.logger.error('Error in bulk insert', error);
        }
    }
    async findLatestForEachName() {
        const metrics = await this.metricRepository
            .createQueryBuilder('metric')
            .distinctOn(['metric.mt_name'])
            .orderBy('metric.mt_name')
            .addOrderBy('metric.mt_time_2', 'DESC')
            .getMany();
        const result = {};
        metrics.forEach((metric) => {
            result[metric.mt_name] = {
                value: Number(metric.mt_value),
                time: metric.mt_time_2,
            };
        });
        return result;
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = MetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(metric_entity_1.Metric)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MetricsService);
//# sourceMappingURL=metrics.service.js.map