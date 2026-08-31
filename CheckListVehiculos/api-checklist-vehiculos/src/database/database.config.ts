import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Checklist } from '../entities/checklist.entity';
import { ChecklistImage } from '../entities/checklist-image.entity';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      username: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASS'),
      database: this.configService.get<string>('DB_NAME'),
      entities: [User, Vehicle, Checklist, ChecklistImage],
      synchronize: true, // Use carefully in production
      ssl: {
        rejectUnauthorized: false,
      },
    };
  }
}
