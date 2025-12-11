"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parc57Module = void 0;
const common_1 = require("@nestjs/common");
const metrics_controller_1 = require("./controllers/metrics.controller");
const metrics_service_1 = require("./services/metrics.service");
const database_module_1 = require("../config/database.module");
let Parc57Module = class Parc57Module {
};
exports.Parc57Module = Parc57Module;
exports.Parc57Module = Parc57Module = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [metrics_controller_1.MetricsController],
        providers: [metrics_service_1.MetricsService],
    })
], Parc57Module);
//# sourceMappingURL=parc57.module.js.map