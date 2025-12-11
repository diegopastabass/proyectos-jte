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
exports.MaintenancesController = void 0;
const common_1 = require("@nestjs/common");
const maintenances_service_1 = require("../services/maintenances.service");
const create_maintenance_dto_1 = require("../models/create-maintenance.dto");
let MaintenancesController = class MaintenancesController {
    service;
    constructor(service) {
        this.service = service;
    }
    async create(dto) {
        const insertedId = await this.service.create(dto);
        return { success: true, insertedId };
    }
    async findOne(id) {
        const maintenance = await this.service.find(id);
        if (!maintenance) {
            return { success: false, message: 'Maintenance not found' };
        }
        return { success: true, maintenance };
    }
};
exports.MaintenancesController = MaintenancesController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_maintenance_dto_1.CreateMaintenanceDto]),
    __metadata("design:returntype", Promise)
], MaintenancesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MaintenancesController.prototype, "findOne", null);
exports.MaintenancesController = MaintenancesController = __decorate([
    (0, common_1.Controller)('maintenances'),
    __metadata("design:paramtypes", [maintenances_service_1.MaintenancesService])
], MaintenancesController);
//# sourceMappingURL=maintenances.controller.js.map