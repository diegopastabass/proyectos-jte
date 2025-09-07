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
const create_metric_dto_1 = require("../models/create-metric.dto");
let MetricsController = class MetricsController {
    service;
    constructor(service) {
        this.service = service;
    }
    async create(dto) {
        const insertedId = await this.service.create(dto);
        return { success: true, insertedId };
    }
    async latest(limit) {
        return this.service.findLatest(limit);
    }
    async latestByName(name) {
        return this.service.findLatestByName(name);
    }
    async latestAllNames() {
        return this.service.findLatestForEachName();
    }
    async latestUpdate() {
        return this.service.findLastUpdateTime();
    }
    async emptyingTimes() {
        return this.service.estimateEmptyingTimes();
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
    (0, common_1.Get)("limit/:limit"),
    __param(0, (0, common_1.Param)("limit", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "latest", null);
__decorate([
    (0, common_1.Get)("name/:name"),
    __param(0, (0, common_1.Param)("name")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "latestByName", null);
__decorate([
    (0, common_1.Get)("latest"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "latestAllNames", null);
__decorate([
    (0, common_1.Get)("update"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "latestUpdate", null);
__decorate([
    (0, common_1.Get)("emptying"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MetricsController.prototype, "emptyingTimes", null);
exports.MetricsController = MetricsController = __decorate([
    (0, common_1.Controller)("metrics"),
    __metadata("design:paramtypes", [metrics_service_1.MetricsService])
], MetricsController);
//# sourceMappingURL=metrics.controller.js.map