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
const date_range_dto_1 = require("../models/dto/date-range.dto");
let MetricsController = class MetricsController {
    metricsService;
    constructor(metricsService) {
        this.metricsService = metricsService;
    }
    async latestAllNames() {
        return this.metricsService.findLatestForEachName();
    }
    async getDailyTotalizer(name, { start, end }) {
        return this.metricsService.getDailyTotalizer(name, start, end);
    }
    async getMonthlyTotalizer(name, { meses }) {
        return this.metricsService.getMonthlyTotalizer(name, meses);
    }
    async getFlowRate(name, { start, end }) {
        return this.metricsService.getFlowRate(name, start, end);
    }
    async getHourlyTotalizer(name, { start, end }) {
        return this.metricsService.getHourlyTotalizer(name, start, end);
    }
    async getHourlyVolumeFromFlow(name, { start, end }) {
        return this.metricsService.getHourlyVolumeFromFlow(name, start, end);
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Get)('latest'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "latestAllNames", null);
__decorate([
    (0, common_1.Get)('totalizador/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getDailyTotalizer", null);
__decorate([
    (0, common_1.Get)('totalizador-mes/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, date_range_dto_1.MesesDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getMonthlyTotalizer", null);
__decorate([
    (0, common_1.Get)('caudal/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getFlowRate", null);
__decorate([
    (0, common_1.Get)('totalizador-hora/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getHourlyTotalizer", null);
__decorate([
    (0, common_1.Get)('consumo-hora/:name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getHourlyVolumeFromFlow", null);
exports.MetricsController = MetricsController = __decorate([
    (0, common_1.Controller)(''),
    __metadata("design:paramtypes", [metrics_service_1.MetricsService])
], MetricsController);
//# sourceMappingURL=metrics.controller.js.map