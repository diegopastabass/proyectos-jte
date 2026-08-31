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
exports.VehiculoController = void 0;
const common_1 = require("@nestjs/common");
const vehicle_service_js_1 = require("./vehicle.service.js");
const create_vehicle_dto_js_1 = require("./models/create-vehicle.dto.js");
const update_vehicle_dto_js_1 = require("./models/update-vehicle.dto.js");
const jwt_auth_guard_js_1 = require("../auth/jwt-auth.guard.js");
let VehiculoController = class VehiculoController {
    vehiculoService;
    constructor(vehiculoService) {
        this.vehiculoService = vehiculoService;
    }
    create(createVehiculoDto) {
        return this.vehiculoService.create(createVehiculoDto);
    }
    findAll() {
        return this.vehiculoService.findAll();
    }
    findOne(id) {
        return this.vehiculoService.findOne(id);
    }
    async findByPatente(patente) {
        const vehiculo = await this.vehiculoService.findByPatente(patente);
        if (!vehiculo) {
            return { status: 'no_registrado', patente };
        }
        return { status: 'registrado', data: vehiculo };
    }
    update(id, updateVehiculoDto) {
        return this.vehiculoService.update(id, updateVehiculoDto);
    }
    remove(id) {
        return this.vehiculoService.remove(id);
    }
};
exports.VehiculoController = VehiculoController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_vehicle_dto_js_1.CreateVehiculoDto]),
    __metadata("design:returntype", void 0)
], VehiculoController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], VehiculoController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], VehiculoController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('patente/:patente'),
    __param(0, (0, common_1.Param)('patente')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VehiculoController.prototype, "findByPatente", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_vehicle_dto_js_1.UpdateVehiculoDto]),
    __metadata("design:returntype", void 0)
], VehiculoController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], VehiculoController.prototype, "remove", null);
exports.VehiculoController = VehiculoController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    (0, common_1.Controller)('vehiculos'),
    __metadata("design:paramtypes", [vehicle_service_js_1.VehiculoService])
], VehiculoController);
//# sourceMappingURL=vehicle.controller.js.map