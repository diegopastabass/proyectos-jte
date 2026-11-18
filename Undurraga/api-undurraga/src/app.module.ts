import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { DatabaseModule } from './config/database.module';

@Module({
  imports: [DatabaseModule, MetricsModule],
})
export class AppModule {}
