import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from './config/database.module.js';
import { DatabaseConfig } from './config/database.config.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { OwnersModule } from './owners/owners.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
import { RecognitionModule } from './recognition/recognition.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [DatabaseModule],
      useExisting: DatabaseConfig,
    }),

    AuthModule,
    UsersModule,
    OwnersModule,
    VehiclesModule,
    RecognitionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
