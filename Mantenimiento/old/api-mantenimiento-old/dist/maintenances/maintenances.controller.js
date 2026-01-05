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
const maintenances_service_1 = require("./maintenances.service");
const create_maintenance_dto_1 = require("./create-maintenance.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const current_user_decorator_1 = require("../auth/current-user.decorator");
let MaintenancesController = class MaintenancesController {
    service;
    constructor(service) {
        this.service = service;
    }
    async create(user, dto) {
        if (!user?.id) {
            throw new common_1.BadRequestException('Invalid user ID');
        }
        try {
            const insertedId = await this.service.create({
                ...dto,
                admin_id: user.id,
            });
            return { success: true, insertedId };
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    }
    async findOne(id) {
        const maintenance = await this.service.find(id);
        if (!maintenance) {
            return { success: false, message: 'Maintenance not found' };
        }
        return { success: true, maintenance };
    }
    async findByAdmin(user) {
        const maintenances = await this.service.findByAdmin(user.id);
        return { success: true, maintenances };
    }
    async findByMaintainer(user) {
        const maintenances = await this.service.findByMaintainer(user.id);
        return { success: true, maintenances };
    }
};
exports.MaintenancesController = MaintenancesController;
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_maintenance_dto_1.CreateMaintenanceDto]),
    __metadata("design:returntype", Promise)
], MaintenancesController.prototype, "create", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('find/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], MaintenancesController.prototype, "findOne", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Get)('admin'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MaintenancesController.prototype, "findByAdmin", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('maintainer'),
    (0, common_1.Get)('maintainer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MaintenancesController.prototype, "findByMaintainer", null);
exports.MaintenancesController = MaintenancesController = __decorate([
    (0, common_1.Controller)('maintenances'),
    __metadata("design:paramtypes", [maintenances_service_1.MaintenancesService])
], MaintenancesController);
//# sourceMappingURL=maintenances.controller.js.map