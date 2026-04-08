import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from './database/database.module';
import { DatabaseConfig } from './database/database.config';
import { SsrAuquincoModule } from './metrics/metrics.module';

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

    DatabaseModule,
    SsrAuquincoModule,
  ],
})
export class AppModule {}
