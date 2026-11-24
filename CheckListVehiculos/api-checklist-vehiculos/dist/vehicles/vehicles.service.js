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
var VehiclesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehiclesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const checklist_entity_1 = require("../entities/checklist.entity");
const vehicle_entity_1 = require("../entities/vehicle.entity");
let VehiclesService = VehiclesService_1 = class VehiclesService {
    constructor(vehiclesRepository, checklistsRepository) {
        this.vehiclesRepository = vehiclesRepository;
        this.checklistsRepository = checklistsRepository;
        this.logger = new common_1.Logger(VehiclesService_1.name);
    }
    async create(createVehicleDto) {
        try {
            const existing = await this.vehiclesRepository.findOne({ where: { patente: createVehicleDto.patente } });
            if (existing)
                throw new common_1.ConflictException('Patente already exists');
            const vehicle = this.vehiclesRepository.create(createVehicleDto);
            return await this.vehiclesRepository.save(vehicle);
        }
        catch (error) {
            this.logger.error(`Error in create: ${error.message}`, error.stack);
            throw error;
        }
    }
    async findAll() {
        try {
            return await this.vehiclesRepository.find({ where: { is_active: true } });
        }
        catch (error) {
            this.logger.error(`Error in findAll: ${error.message}`, error.stack);
            throw error;
        }
    }
    async findOne(id) {
        try {
            const vehicle = await this.vehiclesRepository.findOne({ where: { id } });
            if (!vehicle)
                throw new common_1.NotFoundException('Vehicle not found');
            return vehicle;
        }
        catch (error) {
            this.logger.error(`Error in findOne: ${error.message}`, error.stack);
            throw error;
        }
    }
    async update(id, updateVehicleDto) {
        try {
            const vehicle = await this.findOne(id);
            if (updateVehicleDto.patente && updateVehicleDto.patente !== vehicle.patente) {
                const taken = await this.vehiclesRepository.findOne({ where: { patente: updateVehicleDto.patente } });
                if (taken && taken.id !== id)
                    throw new common_1.ConflictException('Patente already exists');
            }
            if (updateVehicleDto.kilometraje !== undefined && updateVehicleDto.kilometraje < vehicle.kilometraje) {
                const { max } = await this.checklistsRepository
                    .createQueryBuilder('c')
                    .select('MAX(c.kilometraje_actual)', 'max')
                    .where('c.vehicle_id = :id', { id })
                    .getRawOne();
                if (max !== null && updateVehicleDto.kilometraje < Number(max)) {
                    throw new common_1.BadRequestException(`El kilometraje no puede ser menor al último checklist (${max} km)`);
                }
            }
            Object.assign(vehicle, updateVehicleDto);
            return await this.vehiclesRepository.save(vehicle);
        }
        catch (error) {
            this.logger.error(`Error in update: ${error.message}`, error.stack);
            throw error;
        }
    }
    async resetMantencion(id) {
        try {
            const vehicle = await this.findOne(id);
            vehicle.km_ultima_mantencion = vehicle.kilometraje;
            return await this.vehiclesRepository.save(vehicle);
        }
        catch (error) {
            this.logger.error(`Error in resetMantencion: ${error.message}`, error.stack);
            throw error;
        }
    }
    async remove(id) {
        try {
            const vehicle = await this.findOne(id);
            vehicle.is_active = false;
            await this.vehiclesRepository.save(vehicle);
        }
        catch (error) {
            this.logger.error(`Error in remove: ${error.message}`, error.stack);
            throw error;
        }
    }
};
exports.VehiclesService = VehiclesService;
exports.VehiclesService = VehiclesService = VehiclesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(vehicle_entity_1.Vehicle)),
    __param(1, (0, typeorm_1.InjectRepository)(checklist_entity_1.Checklist)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], VehiclesService);
//# sourceMappingURL=vehicles.service.js.map