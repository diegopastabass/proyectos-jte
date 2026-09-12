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
exports.SsrTrinidadController = void 0;
const common_1 = require("@nestjs/common");
const metrics_service_1 = require("./metrics.service");
const date_range_dto_1 = require("./models/dto/date-range.dto");
let SsrTrinidadController = class SsrTrinidadController {
    service;
    constructor(service) {
        this.service = service;
    }
    getSnapshot() {
        return this.service.getSnapshot();
    }
    getTotalizador_pozo(dto) {
        return this.service.getTotalizador_pozo(dto);
    }
    getTotalizador_sentina(dto) {
        return this.service.getTotalizador_sentina(dto);
    }
    getHorometro_e1(dto) {
        return this.service.getHorometro_e1(dto);
    }
    getHorometro_e2(dto) {
        return this.service.getHorometro_e2(dto);
    }
    getHorometro_bomba_pozo(dto) {
        return this.service.getHorometro_pozo(dto);
    }
    getNivel(dto) {
        return this.service.getNivel(dto);
    }
    getCaudal(dto) {
        return this.service.getCaudal(dto);
    }
};
exports.SsrTrinidadController = SsrTrinidadController;
__decorate([
    (0, common_1.Get)('snapshot'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SsrTrinidadController.prototype, "getSnapshot", null);
__decorate([
    (0, common_1.Get)('totalizador_pozo'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrTrinidadController.prototype, "getTotalizador_pozo", null);
__decorate([
    (0, common_1.Get)('totalizador_sentina'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrTrinidadController.prototype, "getTotalizador_sentina", null);
__decorate([
    (0, common_1.Get)('horometro_e1'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrTrinidadController.prototype, "getHorometro_e1", null);
__decorate([
    (0, common_1.Get)('horometro_e2'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrTrinidadController.prototype, "getHorometro_e2", null);
__decorate([
    (0, common_1.Get)('horometro_pozo'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrTrinidadController.prototype, "getHorometro_bomba_pozo", null);
__decorate([
    (0, common_1.Get)('nivel'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrTrinidadController.prototype, "getNivel", null);
__decorate([
    (0, common_1.Get)('caudal'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], SsrTrinidadController.prototype, "getCaudal", null);
exports.SsrTrinidadController = SsrTrinidadController = __decorate([
    (0, common_1.Controller)(''),
    __metadata("design:paramtypes", [metrics_service_1.SsrTrinidadService])
], SsrTrinidadController);
//# sourceMappingURL=metrics.controller.js.map