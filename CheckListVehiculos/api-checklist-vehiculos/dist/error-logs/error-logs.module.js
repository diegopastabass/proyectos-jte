"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorLogsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const error_log_entity_1 = require("../entities/error-log.entity");
const error_logs_controller_1 = require("./error-logs.controller");
const error_logs_service_1 = require("./error-logs.service");
let ErrorLogsModule = class ErrorLogsModule {
};
exports.ErrorLogsModule = ErrorLogsModule;
exports.ErrorLogsModule = ErrorLogsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([error_log_entity_1.ErrorLog])],
        controllers: [error_logs_controller_1.ErrorLogsController],
        providers: [error_logs_service_1.ErrorLogsService],
        exports: [error_logs_service_1.ErrorLogsService],
    })
], ErrorLogsModule);
//# sourceMappingURL=error-logs.module.js.map