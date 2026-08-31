"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehiclesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const vehicle_service_js_1 = require("./vehicle.service.js");
const vehicle_controller_js_1 = require("./vehicle.controller.js");
const vehicle_entity_js_1 = require("./models/vehicle.entity.js");
let VehiclesModule = class VehiclesModule {
};
exports.VehiclesModule = VehiclesModule;
exports.VehiclesModule = VehiclesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([vehicle_entity_js_1.Vehiculo])],
        controllers: [vehicle_controller_js_1.VehiculoController],
        providers: [vehicle_service_js_1.VehiculoService],
        exports: [vehicle_service_js_1.VehiculoService],
    })
], VehiclesModule);
//# sourceMappingURL=vehicles.module.js.map