import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChecklistsService } from './checklists.service';
import { ChecklistsController } from './checklists.controller';
import { Checklist } from '../entities/checklist.entity';
import { ChecklistImage } from '../entities/checklist-image.entity';
import { Vehicle } from '../entities/vehicle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Checklist, ChecklistImage, Vehicle])],
  controllers: [ChecklistsController],
  providers: [ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
