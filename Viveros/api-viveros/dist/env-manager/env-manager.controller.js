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
exports.EnvManagerController = void 0;
const common_1 = require("@nestjs/common");
const env_manager_service_1 = require("./env-manager.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
let EnvManagerController = class EnvManagerController {
    constructor(envService) {
        this.envService = envService;
    }
    getEnv() {
        return this.envService.readEnv();
    }
    updateEnv(body) {
        this.envService.updateEnv(body);
        return { message: 'Environment file updated successfully' };
    }
};
exports.EnvManagerController = EnvManagerController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('0'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], EnvManagerController.prototype, "getEnv", null);
__decorate([
    (0, common_1.Patch)(),
    (0, roles_decorator_1.Roles)('0'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EnvManagerController.prototype, "updateEnv", null);
exports.EnvManagerController = EnvManagerController = __decorate([
    (0, common_1.Controller)('env'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [env_manager_service_1.EnvManagerService])
], EnvManagerController);
//# sourceMappingURL=env-manager.controller.js.map