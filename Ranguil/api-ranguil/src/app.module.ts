import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule, CacheInterceptor } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { DatabaseConfig } from './database/database.config';
import { SsrRanguilModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    CacheModule.register({
      ttl: 60000,
      max: 100,
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      imports: [DatabaseModule],
      useExisting: DatabaseConfig,
    }),

    DatabaseModule,
    SsrRanguilModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
})
export class AppModule {}
