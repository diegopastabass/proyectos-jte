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
const metrics_service_1 = require("./metrics.service");
let MetricsController = class MetricsController {
    service;
    constructor(service) {
        this.service = service;
    }
    async latestAllNames() {
        return this.service.findLatestForEachName();
    }
    async latestMetric() {
        return this.service.findLatest();
    }
    async latestUpdate() {
        return this.service.findLastUpdateTime();
    }
    async irrigationInterval() {
        return this.service.findIrrigationInterval();
    }
    async getIrrigationTimeSummary(startDate, endDate) {
        return this.service.getDailyIrrigationSummary(startDate, endDate);
    }
    async getLatestSectorMetrics() {
        return this.service.activeSectors();
    }
};
exports.MetricsController = MetricsController;
__decorate([
    (0, common_1.Get)("/82/latest"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "latestAllNames", null);
__decorate([
    (0, common_1.Get)("/82/metrics"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "latestMetric", null);
__decorate([
    (0, common_1.Get)("/82/update"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "latestUpdate", null);
__decorate([
    (0, common_1.Get)("/82/interval"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "irrigationInterval", null);
__decorate([
    (0, common_1.Get)("/82/summary"),
    __param(0, (0, common_1.Query)("startDate")),
    __param(1, (0, common_1.Query)("endDate")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getIrrigationTimeSummary", null);
__decorate([
    (0, common_1.Get)("/82/sectors"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "getLatestSectorMetrics", null);
exports.MetricsController = MetricsController = __decorate([
    (0, common_1.Controller)(""),
    __metadata("design:paramtypes", [metrics_service_1.MetricsService])
], MetricsController);
//# sourceMappingURL=metrics.controller.js.map