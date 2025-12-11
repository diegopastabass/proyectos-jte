import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.config.get<string>('POSTGRES_DB_HOST'),
      port: this.config.get<number>('POSTGRES_DB_PORT'),
      username: this.config.get<string>('POSTGRES_DB_USER'),
      password: this.config.get<string>('POSTGRES_DB_PASSWORD'),
      database: this.config.get<string>('POSTGRES_DB_NAME'),
      autoLoadEntities: true, 
      synchronize: false, 
      ssl: {
        rejectUnauthorized: false,
      },
    };
  }
}