import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from './models/owner.entity.js';
import { CreatePersonaDto } from './models/create-owner.dto.js';
import { UpdatePersonaDto } from './models/update-owner.dto.js';

@Injectable()
export class OwnersService {
  private readonly logger = new Logger(OwnersService.name);

  constructor(
    @InjectRepository(Persona)
    private readonly personaRepository: Repository<Persona>,
  ) {}

  async create(createPersonaDto: CreatePersonaDto): Promise<Persona> {
    this.logger.log(`Creando persona: ${createPersonaDto.nombre}`);
    try {
      const persona = this.personaRepository.create(createPersonaDto);
      const saved = await this.personaRepository.save(persona);
      this.logger.log(`Persona creada con ID: ${saved.id}`);
      return saved;
    } catch (error) {
      this.logger.error(`Error en create(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al crear persona');
    }
  }

  async findAll(): Promise<Persona[]> {
    this.logger.log('Listando todas las personas');
    try {
      return await this.personaRepository.find({ relations: ['vehiculos'] });
    } catch (error) {
      this.logger.error(`Error en findAll(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al listar personas');
    }
  }

  async findOne(id: number): Promise<Persona> {
    try {
      const persona = await this.personaRepository.findOne({
        where: { id },
        relations: ['vehiculos'],
      });
      if (!persona) {
        this.logger.warn(`Persona ID ${id} no encontrada`);
        throw new NotFoundException(`Persona con id ${id} no encontrada`);
      }
      return persona;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error buscando persona ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al buscar persona');
    }
  }

  async update(id: number, updatePersonaDto: UpdatePersonaDto): Promise<Persona> {
    this.logger.log(`Actualizando persona ID: ${id}`);
    try {
      const persona = await this.findOne(id);
      Object.assign(persona, updatePersonaDto);
      const updated = await this.personaRepository.save(persona);
      this.logger.log(`Persona ID ${id} actualizada exitosamente`);
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error en update(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al actualizar persona');
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    this.logger.log(`Eliminando persona ID: ${id}`);
    try {
      const persona = await this.findOne(id);
      await this.personaRepository.remove(persona);
      this.logger.log(`Persona ID ${id} eliminada exitosamente`);
      return { message: `Persona con id ${id} eliminada exitosamente` };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error en remove(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al eliminar persona');
    }
  }
}
