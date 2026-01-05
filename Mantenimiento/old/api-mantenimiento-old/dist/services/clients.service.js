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
exports.ClientsService = void 0;
const common_1 = require("@nestjs/common");
const database_config_1 = require("../config/database.config");
let ClientsService = class ClientsService {
    dbConfig;
    constructor(dbConfig) {
        this.dbConfig = dbConfig;
    }
    async create(dto) {
        try {
            const [result] = await this.dbConfig.pool.execute('INSERT INTO clients (name, email, rut) VALUES (?, ?, ?)', [dto.name, dto.email, dto.rut]);
            return result.insertId;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error creating client: ${error}`);
        }
    }
    async find(id) {
        try {
            const [rows] = await this.dbConfig.pool.execute('SELECT * FROM clients WHERE id = ?', [id]);
            return rows[0] || null;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching client: ${error}`);
        }
    }
};
exports.ClientsService = ClientsService;
exports.ClientsService = ClientsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_config_1.DatabaseConfig])
], ClientsService);
//# sourceMappingURL=clients.service.js.map