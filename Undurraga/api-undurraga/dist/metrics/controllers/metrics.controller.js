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
const date_range_dto_1 = require("../models/dto/date-range.dto");
const TOTALIZADOR_1 = 4;
const TOTALIZADOR_2 = 3;
const PISCINA = 5;
let MetricsController = class MetricsController {
    constructor(metricsService) {
        this.metricsService = metricsService;
    }
    createMetric(dto) {
        return this.metricsService.createMetric(dto);
    }
    async latest() {
        return this.metricsService.getSnapshot();
    }
    async getSnapshot() {
        return this.metricsService.getSnapshot();
    }
    async getCaudal(sensor, { start, end }) {
        return this.metricsService.getCaudal(sensor, start, end);
    }
    async getDailyTotalizer(sensor, { start, end }) {
        return this.metricsService.getDailyTotalizer(sensor, start, end);
    }
    async getMonthlyTotalizer(sensor, { meses }) {
        return this.metricsService.getMonthlyTotalizer(sensor, meses);
    }
    async getHourlyTotalizer(sensor, { start, end }) {
        return this.metricsService.getHourlyTotalizer(sensor, start, end);
    }
    async getHourlyVolumeFromFlow(sensor, { start, end }) {
        return this.metricsService.getHourlyVolumeFromFlow(sensor, start, end);
    }
    async getTotalizador1({ startDate, endDate }) {
        return this.metricsService.getDailyTotalizer(TOTALIZADOR_1, startDate, endDate);
    }
    async getTotalizador2({ startDate, endDate }) {
        return this.metricsService.getDailyTotalizer(TOTALIZADOR_2, startDate, endDate);
    }
    async getTotalizadorPiscina({ startDate, endDate }) {
        return this.metricsService.getDailyTotalizer(PISCINA, startDate, endDate);
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({ transform: true })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_metric_dto_1.CreateMetricDto]),
    __metadata("design:returntype", void 0)
], MetricsController.prototype, "createMetric", null);
__decorate([
    (0, common_1.Get)('latest'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "latest", null);
__decorate([
    (0, common_1.Get)('snapshot'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getSnapshot", null);
__decorate([
    (0, common_1.Get)('caudal/:sensor'),
    __param(0, (0, common_1.Param)('sensor', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getCaudal", null);
__decorate([
    (0, common_1.Get)('totalizador/:sensor'),
    __param(0, (0, common_1.Param)('sensor', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getDailyTotalizer", null);
__decorate([
    (0, common_1.Get)('totalizador-mes/:sensor'),
    __param(0, (0, common_1.Param)('sensor', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, date_range_dto_1.MesesDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getMonthlyTotalizer", null);
__decorate([
    (0, common_1.Get)('totalizador-hora/:sensor'),
    __param(0, (0, common_1.Param)('sensor', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getHourlyTotalizer", null);
__decorate([
    (0, common_1.Get)('consumo-hora/:sensor'),
    __param(0, (0, common_1.Param)('sensor', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getHourlyVolumeFromFlow", null);
__decorate([
    (0, common_1.Get)('totalizador-1'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.LegacyDateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getTotalizador1", null);
__decorate([
    (0, common_1.Get)('totalizador-2'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.LegacyDateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getTotalizador2", null);
__decorate([
    (0, common_1.Get)('totalizador-piscina'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.LegacyDateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getTotalizadorPiscina", null);
exports.MetricsController = MetricsController = __decorate([
    (0, common_1.Controller)(''),
    __metadata("design:paramtypes", [metrics_service_1.MetricsService])
], MetricsController);
//# sourceMappingURL=metrics.controller.js.map