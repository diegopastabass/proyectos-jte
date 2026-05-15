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
var SessionsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const sessions_service_1 = require("./sessions.service");
const multer_1 = require("multer");
const path_1 = require("path");
let SessionsController = SessionsController_1 = class SessionsController {
    sessionsService;
    logger = new common_1.Logger(SessionsController_1.name);
    constructor(sessionsService) {
        this.sessionsService = sessionsService;
    }
    serveImage(filename, res) {
        const filePath = this.sessionsService.getStaticFile(filename);
        res.sendFile(filePath);
    }
    async getExportData(start, end) {
        if (!start || !end) {
            throw new common_1.BadRequestException('Debe proporcionar start y end dates');
        }
        return this.sessionsService.findMeasurementsByRange(start, end);
    }
    async create(files, dataString) {
        this.logger.log(`Creando sesión con datos: ${dataString}`);
        if (!dataString)
            throw new common_1.BadRequestException('Faltan datos de la sesión');
        const sessionData = JSON.parse(dataString);
        return this.sessionsService.createFullSession(sessionData, files);
    }
    findAll() {
        return this.sessionsService.findAll();
    }
    findOne(id) {
        return this.sessionsService.findOne(id);
    }
    remove(id) {
        return this.sessionsService.remove(id);
    }
    async update(id, files, dataString) {
        this.logger.log(`Actualizando sesión ${id} con datos: ${dataString}`);
        if (!dataString)
            throw new common_1.BadRequestException('Faltan datos de la actualización');
        const sessionData = JSON.parse(dataString);
        return this.sessionsService.updateSession(id, sessionData, files);
    }
    async getReportData(id) {
        this.logger.log(`Solicitando datos JSON de reporte ID: ${id}`);
        const data = await this.sessionsService.getReportData(id);
        if (!data)
            throw new common_1.NotFoundException('Datos no encontrados');
        return data;
    }
};
exports.SessionsController = SessionsController;
__decorate([
    (0, common_1.Get)('app/uploads/:filename'),
    __param(0, (0, common_1.Param)('filename')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "serveImage", null);
__decorate([
    (0, common_1.Get)('export'),
    __param(0, (0, common_1.Query)('start')),
    __param(1, (0, common_1.Query)('end')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], SessionsController.prototype, "getExportData", null);
__decorate([
    (0, common_1.Post)('app/'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 10, {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, `${file.fieldname}-${uniqueSuffix}${(0, path_1.extname)(file.originalname)}`);
            },
        }),
    })),
    __param(0, (0, common_1.UploadedFiles)()),
    __param(1, (0, common_1.Body)('data')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, String]),
    __metadata("design:returntype", Promise)
], SessionsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('app/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('app/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)('app/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SessionsController.prototype, "remove", null);
__decorate([
    (0, common_1.Patch)('app/:id'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 3, {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads',
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                cb(null, `${file.fieldname}-${uniqueSuffix}${(0, path_1.extname)(file.originalname)}`);
            },
        }),
    })),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, common_1.Body)('data')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, String]),
    __metadata("design:returntype", Promise)
], SessionsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)('app/report/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SessionsController.prototype, "getReportData", null);
exports.SessionsController = SessionsController = SessionsController_1 = __decorate([
    (0, common_1.Controller)('sessions/'),
    __metadata("design:paramtypes", [sessions_service_1.SessionsService])
], SessionsController);
//# sourceMappingURL=sessions.controller.js.map