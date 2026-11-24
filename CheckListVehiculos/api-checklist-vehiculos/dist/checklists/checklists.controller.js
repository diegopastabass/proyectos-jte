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
var ChecklistsController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const checklists_service_1 = require("./checklists.service");
const create_checklist_dto_1 = require("./dto/create-checklist.dto");
const query_checklists_dto_1 = require("./dto/query-checklists.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const ALLOWED_MIME = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
};
let ChecklistsController = ChecklistsController_1 = class ChecklistsController {
    constructor(checklistsService) {
        this.checklistsService = checklistsService;
        this.logger = new common_1.Logger(ChecklistsController_1.name);
    }
    async create(req, data, files = []) {
        try {
            if (!data) {
                throw new common_1.BadRequestException('Checklist data is required');
            }
            let json;
            try {
                json = JSON.parse(data);
            }
            catch {
                throw new common_1.BadRequestException('Invalid JSON data');
            }
            const dto = (0, class_transformer_1.plainToInstance)(create_checklist_dto_1.CreateChecklistDto, json);
            const errors = await (0, class_validator_1.validate)(dto, { whitelist: true, forbidUnknownValues: true });
            if (errors.length) {
                throw new common_1.BadRequestException(errors.flatMap(e => Object.values(e.constraints ?? {})));
            }
            return await this.checklistsService.create(req.user.userId, dto, files);
        }
        catch (error) {
            await Promise.all((files ?? []).map(f => (0, promises_1.unlink)(f.path).catch(() => undefined)));
            this.logger.error(`Error creating checklist: ${error.message}`, error.stack);
            throw error;
        }
    }
    async findAll(req, query) {
        return this.checklistsService.findAll(req.user, query);
    }
    async findOne(req, id) {
        return this.checklistsService.findOne(String(id), req.user);
    }
    async remove(req, id) {
        return this.checklistsService.remove(String(id), req.user);
    }
};
exports.ChecklistsController = ChecklistsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 26, {
        storage: (0, multer_1.diskStorage)({
            destination: './uploads',
            filename: (_req, file, callback) => callback(null, `${(0, crypto_1.randomUUID)()}${ALLOWED_MIME[file.mimetype] ?? '.jpg'}`),
        }),
        fileFilter: (_req, file, callback) => {
            if (ALLOWED_MIME[file.mimetype])
                return callback(null, true);
            callback(new common_1.BadRequestException('Solo se permiten imágenes JPG, PNG o WebP'), false);
        },
        limits: {
            fieldSize: 1 * 1024 * 1024,
            fileSize: 5 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)('data')),
    __param(2, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Array]),
    __metadata("design:returntype", Promise)
], ChecklistsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, query_checklists_dto_1.QueryChecklistsDto]),
    __metadata("design:returntype", Promise)
], ChecklistsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ChecklistsController.prototype, "findOne", null);
__decorate([
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(true),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], ChecklistsController.prototype, "remove", null);
exports.ChecklistsController = ChecklistsController = ChecklistsController_1 = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('checklists'),
    __metadata("design:paramtypes", [checklists_service_1.ChecklistsService])
], ChecklistsController);
//# sourceMappingURL=checklists.controller.js.map