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
exports.ErrorLogsController = void 0;
const common_1 = require("@nestjs/common");
const throttler_1 = require("@nestjs/throttler");
const error_logs_service_1 = require("./error-logs.service");
const create_error_log_dto_1 = require("./dto/create-error-log.dto");
let ErrorLogsController = class ErrorLogsController {
    constructor(errorLogsService) {
        this.errorLogsService = errorLogsService;
    }
    async logError(body) {
        return this.errorLogsService.createErrorLog(body.user_id, body.error, body.timestamp);
    }
};
exports.ErrorLogsController = ErrorLogsController;
__decorate([
    (0, throttler_1.Throttle)({ default: { limit: 20, ttl: 60000 } }),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_error_log_dto_1.CreateErrorLogDto]),
    __metadata("design:returntype", Promise)
], ErrorLogsController.prototype, "logError", null);
exports.ErrorLogsController = ErrorLogsController = __decorate([
    (0, common_1.Controller)('error-logs'),
    __metadata("design:paramtypes", [error_logs_service_1.ErrorLogsService])
], ErrorLogsController);
//# sourceMappingURL=error-logs.controller.js.map