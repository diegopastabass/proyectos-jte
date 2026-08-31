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
var RecognitionController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecognitionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const recognition_service_js_1 = require("./recognition.service.js");
const jwt_auth_guard_js_1 = require("../auth/jwt-auth.guard.js");
let RecognitionController = RecognitionController_1 = class RecognitionController {
    recognitionService;
    logger = new common_1.Logger(RecognitionController_1.name);
    constructor(recognitionService) {
        this.recognitionService = recognitionService;
    }
    async detect(file) {
        if (!file) {
            throw new common_1.BadRequestException('Debe enviar una imagen con el campo "image"');
        }
        this.logger.log(`Imagen recibida: ${file.originalname} (${file.size} bytes)`);
        return this.recognitionService.detectAndVerify(file.buffer);
    }
    async detectBase64(body) {
        if (!body.image) {
            throw new common_1.BadRequestException('Debe enviar la imagen en base64 en el campo "image"');
        }
        this.logger.log(`Imagen base64 recibida (${body.image.length} caracteres)`);
        const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        this.logger.log(`Buffer de imagen: ${imageBuffer.length} bytes`);
        return this.recognitionService.detectAndVerify(imageBuffer);
    }
};
exports.RecognitionController = RecognitionController;
__decorate([
    (0, common_1.Post)('detect'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecognitionController.prototype, "detect", null);
__decorate([
    (0, common_1.Post)('detect-base64'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], RecognitionController.prototype, "detectBase64", null);
exports.RecognitionController = RecognitionController = RecognitionController_1 = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_js_1.JwtAuthGuard),
    (0, common_1.Controller)('recognition'),
    __metadata("design:paramtypes", [recognition_service_js_1.RecognitionService])
], RecognitionController);
//# sourceMappingURL=recognition.controller.js.map