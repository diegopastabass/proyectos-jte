// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrMetricsService } from './metrics.service';
import { SsrMetricsController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrMetricsService],
  controllers: [SsrMetricsController],
  exports: [SsrMetricsService],
})
export class SsrMetricsModule {}
