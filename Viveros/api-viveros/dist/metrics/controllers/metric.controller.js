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
exports.MetricsController = void 0;
const common_1 = require("@nestjs/common");
const metrics_service_1 = require("../services/metrics.service");
const create_metric_dto_1 = require("../models/dto/create-metric.dto");
const common_2 = require("@nestjs/common");
let MetricsController = class MetricsController {
    constructor(metricsService) {
        this.metricsService = metricsService;
    }
    async create(dto) {
        return this.metricsService.createMetric(dto);
    }
    async findLatest() {
        return this.metricsService.findLatestForEachSensor();
    }
    async findSummary(startDate, endDate) {
        return this.metricsService.findMetricsBySensorsAndDateRange(startDate, endDate);
    }
    async findChartDataC() {
        return this.metricsService.findChartData();
    }
    async findData(startDate, endDate) {
        return this.metricsService.getViverosDataForExcel(startDate, endDate);
    }
    async getMinMax(date) {
        if (!date) {
            throw new common_2.BadRequestException('Debe proveer la fecha en formato YYYY-MM-DD');
        }
        try {
            const data = await this.metricsService.getMinMax(date);
            return data;
        }
        catch (error) {
            throw error;
        }
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_metric_dto_1.CreateMetricDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('latest'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "findLatest", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "findSummary", null);
__decorate([
    (0, common_1.Get)('chart'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "findChartDataC", null);
__decorate([
    (0, common_1.Get)('data'),
    __param(0, (0, common_1.Query)('startDate')),
    __param(1, (0, common_1.Query)('endDate')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "findData", null);
__decorate([
    (0, common_1.Get)('min-max'),
    __param(0, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getMinMax", null);
exports.MetricsController = MetricsController = __decorate([
    (0, common_1.Controller)(''),
    __metadata("design:paramtypes", [metrics_service_1.MetricsService])
], MetricsController);
//# sourceMappingURL=metric.controller.js.map