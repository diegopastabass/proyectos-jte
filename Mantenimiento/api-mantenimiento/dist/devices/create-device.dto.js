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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDeviceDto = void 0;
const class_validator_1 = require("class-validator");
class CreateDeviceDto {
    maintenance_id;
    device_type;
    serial_number;
    model;
}
exports.CreateDeviceDto = CreateDeviceDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El ID del mantenimiento es obligatorio' }),
    (0, class_validator_1.IsNumber)({}, { message: 'El ID del mantenimiento debe ser un número' }),
    __metadata("design:type", Number)
], CreateDeviceDto.prototype, "maintenance_id", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El tipo de dispositivo es obligatorio' }),
    (0, class_validator_1.IsString)({ message: 'El tipo de dispositivo debe ser un texto' }),
    __metadata("design:type", String)
], CreateDeviceDto.prototype, "device_type", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'El número de serie debe ser un texto' }),
    __metadata("design:type", String)
], CreateDeviceDto.prototype, "serial_number", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)({ message: 'El modelo es obligatorio' }),
    (0, class_validator_1.IsString)({ message: 'El modelo debe ser un texto' }),
    __metadata("design:type", String)
], CreateDeviceDto.prototype, "model", void 0);
//# sourceMappingURL=create-device.dto.js.map