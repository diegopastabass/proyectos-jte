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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const reports_service_1 = require("./reports.service");
const create_report_dto_1 = require("./models/dto/create-report.dto");
const date_range_dto_1 = require("../metrics/models/dto/date-range.dto");
let ReportsController = class ReportsController {
    service;
    constructor(service) {
        this.service = service;
    }
    create(req, dto) {
        const clientIp = req.ip;
        const isLocalhost = clientIp === '127.0.0.1' ||
            clientIp === '::1' ||
            clientIp === '::ffff:127.0.0.1';
        if (!isLocalhost) {
            throw new common_1.UnauthorizedException('El acceso a este endpoint está restringido a localhost');
        }
        const password = req.headers['x-api-password'];
        if (!password || password !== process.env.REPORTS_API_PASSWORD) {
            throw new common_1.UnauthorizedException('Contraseña inválida o ausente');
        }
        return this.service.create(dto);
    }
    findAll(dto) {
        return this.service.findAll(dto);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_report_dto_1.CreateReportDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [date_range_dto_1.DateRangeDto]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "findAll", null);
exports.ReportsController = ReportsController = __decorate([
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map