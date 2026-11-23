import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Metric } from './models/metric.entity';
import { UmbralEntity } from './models/umbral.entity';
import { MetricsService } from './services/metrics.service';
import { MetricsController } from './controllers/metric.controller';
import { ReportsService } from './services/reports.service';
import { ReportsController } from './controllers/reports.controller';
import { UmbralesService } from './services/umbrales.service';
import { ViverosService } from './services/viveros.service';
import { ViverosController } from './controllers/viveros.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Metric, UmbralEntity])],
  providers: [MetricsService, ReportsService, UmbralesService, ViverosService],
  controllers: [MetricsController, ReportsController, ViverosController],
  exports: [MetricsService],
})
export class MetricsModule {}
