import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Checklist } from '../entities/checklist.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(Checklist)
    private checklistsRepository: Repository<Checklist>,
  ) {}

  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    try {
      const existing = await this.vehiclesRepository.findOne({ where: { patente: createVehicleDto.patente } });
      if (existing) throw new ConflictException('Patente already exists');

      const vehicle = this.vehiclesRepository.create(createVehicleDto);
      return await this.vehiclesRepository.save(vehicle);
    } catch (error) {
      this.logger.error(`Error in create: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(): Promise<Vehicle[]> {
    try {
      return await this.vehiclesRepository.find({ where: { is_active: true } });
    } catch (error) {
      this.logger.error(`Error in findAll: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: string): Promise<Vehicle> {
    try {
      const vehicle = await this.vehiclesRepository.findOne({ where: { id } });
      if (!vehicle) throw new NotFoundException('Vehicle not found');
      return vehicle;
    } catch (error) {
      this.logger.error(`Error in findOne: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto): Promise<Vehicle> {
    try {
      const vehicle = await this.findOne(id);

      if (updateVehicleDto.patente && updateVehicleDto.patente !== vehicle.patente) {
        const taken = await this.vehiclesRepository.findOne({ where: { patente: updateVehicleDto.patente } });
        if (taken && taken.id !== id) throw new ConflictException('Patente already exists');
      }

      // El odómetro no puede quedar bajo el último checklist registrado
      if (updateVehicleDto.kilometraje !== undefined && updateVehicleDto.kilometraje < vehicle.kilometraje) {
        const { max } = await this.checklistsRepository
          .createQueryBuilder('c')
          .select('MAX(c.kilometraje_actual)', 'max')
          .where('c.vehicle_id = :id', { id })
          .getRawOne();
        if (max !== null && updateVehicleDto.kilometraje < Number(max)) {
          throw new BadRequestException(`El kilometraje no puede ser menor al último checklist (${max} km)`);
        }
      }

      Object.assign(vehicle, updateVehicleDto);
      return await this.vehiclesRepository.save(vehicle);
    } catch (error) {
      this.logger.error(`Error in update: ${error.message}`, error.stack);
      throw error;
    }
  }

  async resetMantencion(id: string): Promise<Vehicle> {
    try {
      const vehicle = await this.findOne(id);
      vehicle.km_ultima_mantencion = vehicle.kilometraje;
      return await this.vehiclesRepository.save(vehicle);
    } catch (error) {
      this.logger.error(`Error in resetMantencion: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const vehicle = await this.findOne(id);
      vehicle.is_active = false;
      await this.vehiclesRepository.save(vehicle);
    } catch (error) {
      this.logger.error(`Error in remove: ${error.message}`, error.stack);
      throw error;
    }
  }
}
