"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllParcMetricsModule = void 0;
const common_1 = require("@nestjs/common");
const all_parc_metrics_controller_1 = require("./all-parc-metrics.controller");
const all_parc_metrics_service_1 = require("./all-parc-metrics.service");
const database_module_1 = require("../config/database.module");
let AllParcMetricsModule = class AllParcMetricsModule {
};
exports.AllParcMetricsModule = AllParcMetricsModule;
exports.AllParcMetricsModule = AllParcMetricsModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [all_parc_metrics_controller_1.AllParcMetricsController],
        providers: [all_parc_metrics_service_1.AllParcMetricsService],
    })
], AllParcMetricsModule);
//# sourceMappingURL=all-parc-metrics.module.js.map