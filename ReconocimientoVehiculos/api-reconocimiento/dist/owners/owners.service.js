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
var OwnersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OwnersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const owner_entity_js_1 = require("./models/owner.entity.js");
let OwnersService = OwnersService_1 = class OwnersService {
    personaRepository;
    logger = new common_1.Logger(OwnersService_1.name);
    constructor(personaRepository) {
        this.personaRepository = personaRepository;
    }
    async create(createPersonaDto) {
        this.logger.log(`Creando persona: ${createPersonaDto.nombre}`);
        try {
            const persona = this.personaRepository.create(createPersonaDto);
            const saved = await this.personaRepository.save(persona);
            this.logger.log(`Persona creada con ID: ${saved.id}`);
            return saved;
        }
        catch (error) {
            this.logger.error(`Error en create(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al crear persona');
        }
    }
    async findAll() {
        this.logger.log('Listando todas las personas');
        try {
            return await this.personaRepository.find({ relations: ['vehiculos'] });
        }
        catch (error) {
            this.logger.error(`Error en findAll(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al listar personas');
        }
    }
    async findOne(id) {
        try {
            const persona = await this.personaRepository.findOne({
                where: { id },
                relations: ['vehiculos'],
            });
            if (!persona) {
                this.logger.warn(`Persona ID ${id} no encontrada`);
                throw new common_1.NotFoundException(`Persona con id ${id} no encontrada`);
            }
            return persona;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            this.logger.error(`Error buscando persona ID ${id}: ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al buscar persona');
        }
    }
    async update(id, updatePersonaDto) {
        this.logger.log(`Actualizando persona ID: ${id}`);
        try {
            const persona = await this.findOne(id);
            Object.assign(persona, updatePersonaDto);
            const updated = await this.personaRepository.save(persona);
            this.logger.log(`Persona ID ${id} actualizada exitosamente`);
            return updated;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            this.logger.error(`Error en update(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al actualizar persona');
        }
    }
    async remove(id) {
        this.logger.log(`Eliminando persona ID: ${id}`);
        try {
            const persona = await this.findOne(id);
            await this.personaRepository.remove(persona);
            this.logger.log(`Persona ID ${id} eliminada exitosamente`);
            return { message: `Persona con id ${id} eliminada exitosamente` };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            this.logger.error(`Error en remove(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al eliminar persona');
        }
    }
};
exports.OwnersService = OwnersService;
exports.OwnersService = OwnersService = OwnersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(owner_entity_js_1.Persona)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], OwnersService);
//# sourceMappingURL=owners.service.js.map