import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Checklist } from '../entities/checklist.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { ChecklistImage } from '../entities/checklist-image.entity';
import { CreateChecklistDto } from './dto/create-checklist.dto';

@Injectable()
export class ChecklistsService {
  private readonly logger = new Logger(ChecklistsService.name);

  constructor(
    @InjectRepository(Checklist)
    private checklistsRepository: Repository<Checklist>,
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
    private dataSource: DataSource,
  ) {}

  async create(user_id: string, createChecklistDto: CreateChecklistDto, files: Express.Multer.File[]): Promise<Checklist> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const vehicle = await queryRunner.manager.findOne(Vehicle, { where: { id: createChecklistDto.vehicle_id } });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found');
      }

      if (createChecklistDto.kilometraje_actual < vehicle.kilometraje) {
        throw new BadRequestException('Current kilometraje cannot be less than previous kilometraje');
      }

      vehicle.kilometraje = createChecklistDto.kilometraje_actual;
      await queryRunner.manager.save(vehicle);

      const checklist = queryRunner.manager.create(Checklist, {
        user_id,
        vehicle_id: createChecklistDto.vehicle_id,
        kilometraje_actual: createChecklistDto.kilometraje_actual,
        visual_checks: createChecklistDto.visual_checks,
        mechanical_checks: createChecklistDto.mechanical_checks,
        observaciones_generales: createChecklistDto.observaciones_generales,
        has_issues: createChecklistDto.has_issues,
      });

      const savedChecklist = await queryRunner.manager.save(checklist);

      if (files && files.length > 0) {
        const checklistImages = files.map(file => {
          return queryRunner.manager.create(ChecklistImage, {
            checklist_id: savedChecklist.id,
            image_path: file.filename,
            check_type: 'general', // Assuming default or extracted from file metadata
            check_item: 'general',
            description: file.originalname,
          });
        });
        await queryRunner.manager.save(checklistImages);
      }

      await queryRunner.commitTransaction();
      return await this.checklistsRepository.findOne({ where: { id: savedChecklist.id }, relations: ['images'] });
    } catch (err) {
      this.logger.error(`Error in create: ${err.message}`, err.stack);
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(user: any): Promise<Checklist[]> {
    try {
      if (user.is_admin) {
        return await this.checklistsRepository.find({ relations: ['images', 'vehicle', 'user'], order: { created_at: 'DESC' } });
      }
      return await this.checklistsRepository.find({ where: { user_id: user.userId }, relations: ['images', 'vehicle', 'user'], order: { created_at: 'DESC' } });
    } catch (error) {
      this.logger.error(`Error in findAll: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: string, user: any): Promise<Checklist> {
    try {
      const checklist = await this.checklistsRepository.findOne({ where: { id }, relations: ['images', 'vehicle', 'user'] });
      if (!checklist) {
        throw new NotFoundException('Checklist not found');
      }
      if (!user.is_admin && checklist.user_id !== user.userId) {
        throw new NotFoundException('Checklist not found');
      }
      return checklist;
    } catch (error) {
      this.logger.error(`Error in findOne: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string, user: any): Promise<void> {
    try {
      const checklist = await this.findOne(id, user);
      await this.checklistsRepository.remove(checklist);
    } catch (error) {
      this.logger.error(`Error in remove: ${error.message}`, error.stack);
      throw error;
    }
  }
}
