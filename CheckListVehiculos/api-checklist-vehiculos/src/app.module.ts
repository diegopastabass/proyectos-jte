import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { ErrorLogsModule } from './error-logs/error-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    VehiclesModule,
    ChecklistsModule,
    ErrorLogsModule,
  ],
})
export class AppModule {}
