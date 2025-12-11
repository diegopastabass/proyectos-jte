"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SsrNerquihueModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const metrics_service_1 = require("./metrics.service");
const metrics_controller_1 = require("./metrics.controller");
const metrics_entity_1 = require("./models/metrics.entity");
let SsrNerquihueModule = class SsrNerquihueModule {
};
exports.SsrNerquihueModule = SsrNerquihueModule;
exports.SsrNerquihueModule = SsrNerquihueModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([metrics_entity_1.Telemetria])],
        providers: [metrics_service_1.SsrNerquihueService],
        controllers: [metrics_controller_1.SsrNerquihueController],
        exports: [metrics_service_1.SsrNerquihueService],
    })
], SsrNerquihueModule);
//# sourceMappingURL=metrics.module.js.map