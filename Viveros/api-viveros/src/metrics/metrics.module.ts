import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Metric } from './models/metric.entity';
import { MetricsService } from './services/metrics.service';
import { MetricsController } from './controllers/metric.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Metric])],
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
