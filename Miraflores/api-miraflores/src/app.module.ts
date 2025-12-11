import { Module } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MirafloresModule } from './metrics/metrics.module';
import { Telemetria } from './metrics/models/metrics.entity';

interface EnvironmentVariables {
  DB_HOST: string;
  DB_PORT: string;
  DB_USER: string;
  DB_PASS: string;
  DB_NAME: string;
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<EnvironmentVariables>,
      ): TypeOrmModuleOptions => {
        return {
          type: 'mysql',
          host: config.get('DB_HOST', { infer: true }),
          port: Number(config.get('DB_PORT', { infer: true })),
          username: config.get('DB_USER', { infer: true }),
          password: config.get('DB_PASS', { infer: true }),
          database: config.get('DB_NAME', { infer: true }),
          entities: [Telemetria],
          synchronize: false,
          logging: false,
        };
      },
    }),
    MirafloresModule,
  ],
})
export class AppModule {}
