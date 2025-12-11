"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const database_module_1 = require("./config/database.module");
const database_config_1 = require("./config/database.config");
const parc57_module_1 = require("./57/parc57.module");
const parc82_module_1 = require("./82/parc82.module");
const parc18_module_1 = require("./18/parc18.module");
const all_parc_metrics_module_1 = require("./all-parc-metrics/all-parc-metrics.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ".env",
            }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [database_module_1.DatabaseModule],
                useExisting: database_config_1.DatabaseConfig,
            }),
            database_module_1.DatabaseModule,
            parc57_module_1.Parc57Module,
            parc18_module_1.Parc18Module,
            parc82_module_1.Parc82Module,
            all_parc_metrics_module_1.AllParcMetricsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map