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
exports.MaintenancesService = void 0;
const common_1 = require("@nestjs/common");
const database_config_1 = require("../config/database.config");
let MaintenancesService = class MaintenancesService {
    dbConfig;
    constructor(dbConfig) {
        this.dbConfig = dbConfig;
    }
    async create(dto) {
        try {
            const [result] = await this.dbConfig.pool.execute('INSERT INTO maintenances (client_id, admin_id, maintainer_id, maintenance_type, observations, maintenance_status, scheduled_date, completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
                dto.client_id,
                dto.admin_id,
                dto.maintainer_id,
                dto.maintenance_type,
                dto.observations,
                dto.maintenance_status,
                dto.scheduled_date,
                dto.completed,
            ]);
            return result.insertId;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error creating maintenance: ${error}`);
        }
    }
    async find(id) {
        try {
            const [rows] = await this.dbConfig.pool.execute('SELECT * FROM maintenances WHERE id = ?', [id]);
            return rows[0] || null;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching maintenance: ${error}`);
        }
    }
};
exports.MaintenancesService = MaintenancesService;
exports.MaintenancesService = MaintenancesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_config_1.DatabaseConfig])
], MaintenancesService);
//# sourceMappingURL=maintenances.service.js.map