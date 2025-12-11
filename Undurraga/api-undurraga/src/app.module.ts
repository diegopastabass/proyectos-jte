import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics/metrics.module';
import { DatabaseModule } from './config/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [DatabaseModule, MetricsModule, UsersModule, AuthModule],
})
export class AppModule {}
