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
exports.SsrBalsasController = void 0;
const common_1 = require("@nestjs/common");
const metrics_service_1 = require("./metrics.service");
const date_range_dto_1 = require("./models/dto/date-range.dto");
let SsrBalsasController = class SsrBalsasController {
    service;
    constructor(service) {
        this.service = service;
    }
    getSnapshot() {
        return this.service.getSnapshot();
    }
    getEquipos() {
        return this.service.getEquipos();
    }
    getNivel(dto) {
        return this.service.getNivel(dto);
    }
    getCaudal(dto) {
        return this.service.getCaudal(dto);
    }
    getPresion(dto) {
        return this.service.getPresion(dto);
    }
    getCaudalDescarga(dto) {
        return this.service.getCaudalDescarga(dto);
    }
    getSolar(dto) {
        return this.service.getSolar(dto);
    }
    getVoltaje(dto) {
        return this.service.getVoltaje(dto);
    }
    getCorriente(dto) {
        return this.service.getCorriente(dto);
    }
    getTotalizador(dto) {
        return this.service.getTotalizador(dto);
    }
    getTotalizadorDescarga(dto) {
        return this.service.getTotalizadorDescarga(dto);
    }
    getHorometro(dto) {
        return this.service.getHorometro(dto);
    }
};
exports.SsrBalsasController = SsrBalsasController;
__decorate([
    (0, common_1.Get)('snapshot'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getSnapshot", null);
__decorate([
    (0, common_1.Get)('equipos'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getEquipos", null);
__decorate([
    (0, common_1.Get)('nivel'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getNivel", null);
__decorate([
    (0, common_1.Get)('caudal'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getCaudal", null);
__decorate([
    (0, common_1.Get)('presion'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getPresion", null);
__decorate([
    (0, common_1.Get)('caudal_descarga'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getCaudalDescarga", null);
__decorate([
    (0, common_1.Get)('solar'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getSolar", null);
__decorate([
    (0, common_1.Get)('voltaje'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.VoltajeQueryDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getVoltaje", null);
__decorate([
    (0, common_1.Get)('corriente'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.PozoQueryDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getCorriente", null);
__decorate([
    (0, common_1.Get)('totalizador'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getTotalizador", null);
__decorate([
    (0, common_1.Get)('totalizador_descarga'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getTotalizadorDescarga", null);
__decorate([
    (0, common_1.Get)('horometro'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.PozoQueryDto]),
    __metadata("design:returntype", void 0)
], SsrBalsasController.prototype, "getHorometro", null);
exports.SsrBalsasController = SsrBalsasController = __decorate([
    (0, common_1.Controller)(''),
    __metadata("design:paramtypes", [metrics_service_1.SsrBalsasService])
], SsrBalsasController);
//# sourceMappingURL=metrics.controller.js.map