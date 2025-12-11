import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { DatabaseModule } from './config/config.module';

@Module({
  imports: [MetricsModule, DatabaseModule],
})
export class AppModule {}
