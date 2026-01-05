// maintenances.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMaintenanceDto } from './create-maintenance.dto';
import { Maintenance } from './maintenances.entity';

@Injectable()
export class MaintenancesService {
  constructor(
    @InjectRepository(Maintenance)
    private readonly maintenanceRepository: Repository<Maintenance>,
  ) {}

  async create(dto: CreateMaintenanceDto): Promise<number> {
    try {
      const maintenance = this.maintenanceRepository.create({
        ...dto,
        admin_id: Number(dto.admin_id), // capa extra de seguridad
      });
      await this.maintenanceRepository.save(maintenance);
      return maintenance.id;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error creating maintenance: ${error.message}`,
      );
    }
  }

  async find(id: number): Promise<Maintenance | null> {
    try {
      return await this.maintenanceRepository.findOne({ where: { id } });
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching maintenance: ${error}`,
      );
    }
  }

  async findByAdmin(admin_id: number): Promise<Maintenance[]> {
    try {
      return await this.maintenanceRepository.find({ where: { admin_id } });
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching maintenances by admin: ${error}`,
      );
    }
  }

  async findByMaintainer(maintainer_id: number): Promise<Maintenance[]> {
    try {
      return await this.maintenanceRepository.find({
        where: { maintainer_id },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching maintenances by maintainer: ${error}`,
      );
    }
  }
}
