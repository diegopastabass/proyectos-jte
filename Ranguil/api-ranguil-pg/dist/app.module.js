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
const typeorm_1 = require("@nestjs/typeorm");
const config_1 = require("@nestjs/config");
const metrics_module_1 = require("./metrics/metrics.module");
const metrics_entity_1 = require("./metrics/models/metrics.entity");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    return {
                        type: 'mysql',
                        host: config.get('DB_HOST', { infer: true }),
                        port: Number(config.get('DB_PORT', { infer: true })),
                        username: config.get('DB_USER', { infer: true }),
                        password: config.get('DB_PASS', { infer: true }),
                        database: config.get('DB_NAME', { infer: true }),
                        entities: [metrics_entity_1.Telemetria],
                        synchronize: false,
                        logging: false,
                    };
                },
            }),
            metrics_module_1.SsrRanguilModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map