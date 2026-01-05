import { Module } from '@nestjs/common';
import { DatabaseModule } from './config/database.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { MaintenancesModule } from './maintenances/maintenances.module';
import { DevicesModule } from './devices/devices.module';
import { TasksModule } from './tasks/tasks.module';
import { MeasurementsModule } from './measurements/measurements.module';
import { AuthModule } from './auth/auth.module';
@Module({
  imports: [
    DatabaseModule,
    UsersModule,
    ClientsModule,
    MaintenancesModule,
    DevicesModule,
    TasksModule,
    MeasurementsModule,
    AuthModule,
  ],
})
export class AppModule {}
