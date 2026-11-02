import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.config.get<string>('DB_HOST'),
      port: Number(this.config.get<string>('DB_PORT') ?? 5432),
      username: this.config.get<string>('DB_USER'),
      password: this.config.get<string>('DB_PASS'),
      database: this.config.get<string>('DB_NAME'),
      autoLoadEntities: true,
      // El esquema se maneja con los scripts de db/, nunca desde TypeORM.
      synchronize: false,
      // RDS exige SSL; en local se desactiva con DB_SSL=false.
      ssl:
        this.config.get<string>('DB_SSL') === 'false'
          ? false
          : { rejectUnauthorized: false },
    };
  }
}
