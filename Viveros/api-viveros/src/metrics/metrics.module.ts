import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Metric } from './models/metric.entity';
import { MetricsService } from './services/metrics.service';
import { MetricsController } from './controllers/metric.controller';
import { ReportsService } from './services/reports.service';
import { ReportsController } from './controllers/reports.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Metric])],
  providers: [MetricsService, ReportsService],
  controllers: [MetricsController, ReportsController],
  exports: [MetricsService],
})
export class MetricsModule {}
