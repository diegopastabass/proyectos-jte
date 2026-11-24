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
exports.CreateVehicleDto = exports.PATENTE_REGEX = exports.emptyToNull = exports.normalizePatente = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const normalizePatente = ({ value }) => typeof value === 'string' ? value.toUpperCase().replace(/[\s-]/g, '') : value;
exports.normalizePatente = normalizePatente;
const emptyToNull = ({ value }) => (value === '' ? null : value);
exports.emptyToNull = emptyToNull;
exports.PATENTE_REGEX = /^([A-Z]{2}[0-9]{4}|[A-Z]{4}[0-9]{2}|[A-Z]{3}[0-9]{2})$/;
class CreateVehicleDto {
}
exports.CreateVehicleDto = CreateVehicleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateVehicleDto.prototype, "model", void 0);
__decorate([
    (0, class_transformer_1.Transform)(exports.normalizePatente),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Matches)(exports.PATENTE_REGEX, { message: 'Formato de patente inválido (ej: ABCD12 o AB1234)' }),
    __metadata("design:type", String)
], CreateVehicleDto.prototype, "patente", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(2_000_000),
    __metadata("design:type", Number)
], CreateVehicleDto.prototype, "kilometraje", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(2_000_000),
    __metadata("design:type", Number)
], CreateVehicleDto.prototype, "km_ultima_mantencion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.emptyToNull),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateVehicleDto.prototype, "fecha_venc_revision_tecnica", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.emptyToNull),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateVehicleDto.prototype, "fecha_venc_circulacion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(exports.emptyToNull),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateVehicleDto.prototype, "fecha_prox_mantencion", void 0);
//# sourceMappingURL=create-vehicle.dto.js.map