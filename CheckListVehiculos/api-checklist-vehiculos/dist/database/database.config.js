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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConfigService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const user_entity_1 = require("../entities/user.entity");
const vehicle_entity_1 = require("../entities/vehicle.entity");
const checklist_entity_1 = require("../entities/checklist.entity");
const checklist_image_entity_1 = require("../entities/checklist-image.entity");
let DatabaseConfigService = class DatabaseConfigService {
    constructor(configService) {
        this.configService = configService;
    }
    createTypeOrmOptions() {
        return {
            type: 'postgres',
            host: this.configService.get('DB_HOST'),
            port: this.configService.get('DB_PORT'),
            username: this.configService.get('DB_USER'),
            password: this.configService.get('DB_PASS'),
            database: this.configService.get('DB_NAME'),
            entities: [user_entity_1.User, vehicle_entity_1.Vehicle, checklist_entity_1.Checklist, checklist_image_entity_1.ChecklistImage],
            synchronize: true,
            ssl: {
                rejectUnauthorized: false,
            },
        };
    }
};
exports.DatabaseConfigService = DatabaseConfigService;
exports.DatabaseConfigService = DatabaseConfigService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DatabaseConfigService);
//# sourceMappingURL=database.config.js.map