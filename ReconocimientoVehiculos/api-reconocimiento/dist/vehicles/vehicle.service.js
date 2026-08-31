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
var VehiculoService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehiculoService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const vehicle_entity_js_1 = require("./models/vehicle.entity.js");
let VehiculoService = VehiculoService_1 = class VehiculoService {
    vehiculoRepository;
    logger = new common_1.Logger(VehiculoService_1.name);
    constructor(vehiculoRepository) {
        this.vehiculoRepository = vehiculoRepository;
    }
    async create(createVehiculoDto) {
        this.logger.log(`Registrando vehículo con patente: ${createVehiculoDto.patente}`);
        try {
            const existing = await this.vehiculoRepository.findOne({
                where: { patente: createVehiculoDto.patente },
            });
            if (existing) {
                throw new common_1.ConflictException(`La patente ${createVehiculoDto.patente} ya está registrada`);
            }
            const vehiculo = this.vehiculoRepository.create(createVehiculoDto);
            const saved = await this.vehiculoRepository.save(vehiculo);
            this.logger.log(`Vehículo registrado con ID: ${saved.id}`);
            return saved;
        }
        catch (error) {
            if (error instanceof common_1.ConflictException)
                throw error;
            this.logger.error(`Error en create(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al registrar vehículo');
        }
    }
    async findAll() {
        this.logger.log('Listando todos los vehículos');
        try {
            return await this.vehiculoRepository.find({ relations: ['persona'] });
        }
        catch (error) {
            this.logger.error(`Error en findAll(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al listar vehículos');
        }
    }
    async findOne(id) {
        try {
            const vehiculo = await this.vehiculoRepository.findOne({
                where: { id },
                relations: ['persona'],
            });
            if (!vehiculo) {
                this.logger.warn(`Vehículo ID ${id} no encontrado`);
                throw new common_1.NotFoundException(`Vehículo con id ${id} no encontrado`);
            }
            return vehiculo;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            this.logger.error(`Error buscando vehículo ID ${id}: ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al buscar vehículo');
        }
    }
    async findByPatente(patente) {
        this.logger.log(`Buscando vehículo con patente: ${patente}`);
        try {
            return await this.vehiculoRepository.findOne({
                where: { patente },
                relations: ['persona'],
            });
        }
        catch (error) {
            this.logger.error(`Error en findByPatente(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al buscar por patente');
        }
    }
    async update(id, updateVehiculoDto) {
        this.logger.log(`Actualizando vehículo ID: ${id}`);
        try {
            const vehiculo = await this.findOne(id);
            if (updateVehiculoDto.patente && updateVehiculoDto.patente !== vehiculo.patente) {
                const existing = await this.vehiculoRepository.findOne({
                    where: { patente: updateVehiculoDto.patente },
                });
                if (existing) {
                    throw new common_1.ConflictException(`La patente ${updateVehiculoDto.patente} ya está registrada`);
                }
            }
            Object.assign(vehiculo, updateVehiculoDto);
            const updated = await this.vehiculoRepository.save(vehiculo);
            this.logger.log(`Vehículo ID ${id} actualizado exitosamente`);
            return updated;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException || error instanceof common_1.ConflictException)
                throw error;
            this.logger.error(`Error en update(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al actualizar vehículo');
        }
    }
    async remove(id) {
        this.logger.log(`Eliminando vehículo ID: ${id}`);
        try {
            const vehiculo = await this.findOne(id);
            await this.vehiculoRepository.remove(vehiculo);
            this.logger.log(`Vehículo ID ${id} eliminado exitosamente`);
            return { message: `Vehículo con id ${id} eliminado exitosamente` };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            this.logger.error(`Error en remove(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al eliminar vehículo');
        }
    }
};
exports.VehiculoService = VehiculoService;
exports.VehiculoService = VehiculoService = VehiculoService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(vehicle_entity_js_1.Vehiculo)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], VehiculoService);
//# sourceMappingURL=vehicle.service.js.map