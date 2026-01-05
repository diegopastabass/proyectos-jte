// maintenances.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Maintenance } from './maintenances.entity';
import { MaintenancesController } from './maintenances.controller';
import { MaintenancesService } from './maintenances.service';

@Module({
  imports: [TypeOrmModule.forFeature([Maintenance])],
  controllers: [MaintenancesController],
  providers: [MaintenancesService],
})
export class MaintenancesModule {}
