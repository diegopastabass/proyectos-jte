import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehiculo } from './models/vehicle.entity.js';
import { CreateVehiculoDto } from './models/create-vehicle.dto.js';
import { UpdateVehiculoDto } from './models/update-vehicle.dto.js';

@Injectable()
export class VehiculoService {
  private readonly logger = new Logger(VehiculoService.name);

  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepository: Repository<Vehiculo>,
  ) {}

  async create(createVehiculoDto: CreateVehiculoDto): Promise<Vehiculo> {
    this.logger.log(`Registrando vehículo con patente: ${createVehiculoDto.patente}`);
    try {
      const existing = await this.vehiculoRepository.findOne({
        where: { patente: createVehiculoDto.patente },
      });
      if (existing) {
        throw new ConflictException(`La patente ${createVehiculoDto.patente} ya está registrada`);
      }

      const vehiculo = this.vehiculoRepository.create(createVehiculoDto);
      const saved = await this.vehiculoRepository.save(vehiculo);
      this.logger.log(`Vehículo registrado con ID: ${saved.id}`);
      return saved;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error(`Error en create(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al registrar vehículo');
    }
  }

  async findAll(): Promise<Vehiculo[]> {
    this.logger.log('Listando todos los vehículos');
    try {
      return await this.vehiculoRepository.find({ relations: ['persona'] });
    } catch (error) {
      this.logger.error(`Error en findAll(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al listar vehículos');
    }
  }

  async findOne(id: number): Promise<Vehiculo> {
    try {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id },
        relations: ['persona'],
      });
      if (!vehiculo) {
        this.logger.warn(`Vehículo ID ${id} no encontrado`);
        throw new NotFoundException(`Vehículo con id ${id} no encontrado`);
      }
      return vehiculo;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error buscando vehículo ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al buscar vehículo');
    }
  }

  async findByPatente(patente: string): Promise<Vehiculo | null> {
    this.logger.log(`Buscando vehículo con patente: ${patente}`);
    try {
      return await this.vehiculoRepository.findOne({
        where: { patente },
        relations: ['persona'],
      });
    } catch (error) {
      this.logger.error(`Error en findByPatente(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al buscar por patente');
    }
  }

  async update(id: number, updateVehiculoDto: UpdateVehiculoDto): Promise<Vehiculo> {
    this.logger.log(`Actualizando vehículo ID: ${id}`);
    try {
      const vehiculo = await this.findOne(id);

      if (updateVehiculoDto.patente && updateVehiculoDto.patente !== vehiculo.patente) {
        const existing = await this.vehiculoRepository.findOne({
          where: { patente: updateVehiculoDto.patente },
        });
        if (existing) {
          throw new ConflictException(`La patente ${updateVehiculoDto.patente} ya está registrada`);
        }
      }

      Object.assign(vehiculo, updateVehiculoDto);
      const updated = await this.vehiculoRepository.save(vehiculo);
      this.logger.log(`Vehículo ID ${id} actualizado exitosamente`);
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) throw error;
      this.logger.error(`Error en update(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al actualizar vehículo');
    }
  }

  async remove(id: number): Promise<{ message: string }> {
    this.logger.log(`Eliminando vehículo ID: ${id}`);
    try {
      const vehiculo = await this.findOne(id);
      await this.vehiculoRepository.remove(vehiculo);
      this.logger.log(`Vehículo ID ${id} eliminado exitosamente`);
      return { message: `Vehículo con id ${id} eliminado exitosamente` };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error en remove(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al eliminar vehículo');
    }
  }
}
