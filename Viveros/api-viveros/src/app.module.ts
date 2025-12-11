import { Module } from '@nestjs/common';
import { DatabaseModule } from './config/database.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MetricsModule } from './metrics/metrics.module';
import { EnvManagerModule } from './env-manager/env-manager.module';

@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    AuthModule,
    MetricsModule,
    EnvManagerModule,
  ],
})
export class AppModule {}
