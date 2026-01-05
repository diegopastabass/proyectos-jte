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
exports.MaintenancesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const maintenances_entity_1 = require("./maintenances.entity");
let MaintenancesService = class MaintenancesService {
    maintenanceRepository;
    constructor(maintenanceRepository) {
        this.maintenanceRepository = maintenanceRepository;
    }
    async create(dto) {
        try {
            const maintenance = this.maintenanceRepository.create({
                ...dto,
                admin_id: Number(dto.admin_id),
            });
            await this.maintenanceRepository.save(maintenance);
            return maintenance.id;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error creating maintenance: ${error.message}`);
        }
    }
    async find(id) {
        try {
            return await this.maintenanceRepository.findOne({ where: { id } });
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching maintenance: ${error}`);
        }
    }
    async findByAdmin(admin_id) {
        try {
            return await this.maintenanceRepository.find({ where: { admin_id } });
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching maintenances by admin: ${error}`);
        }
    }
    async findByMaintainer(maintainer_id) {
        try {
            return await this.maintenanceRepository.find({
                where: { maintainer_id },
            });
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching maintenances by maintainer: ${error}`);
        }
    }
};
exports.MaintenancesService = MaintenancesService;
exports.MaintenancesService = MaintenancesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(maintenances_entity_1.Maintenance)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], MaintenancesService);
//# sourceMappingURL=maintenances.service.js.map