import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Report } from './entities/report.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Report])], // Registra la entidad para TypeORM
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}