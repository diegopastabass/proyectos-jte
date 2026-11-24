import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { readFileSync } from 'fs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { Checklist } from '../entities/checklist.entity';
import { ChecklistImage } from '../entities/checklist-image.entity';
import { ErrorLog } from '../entities/error-log.entity';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const caPath = this.configService.get<string>('DB_SSL_CA');
    return {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST'),
      port: this.configService.get<number>('DB_PORT'),
      username: this.configService.get<string>('DB_USER'),
      password: this.configService.get<string>('DB_PASS'),
      database: this.configService.get<string>('DB_NAME'),
      entities: [User, Vehicle, Checklist, ChecklistImage, ErrorLog],
      // El esquema se cambia con scripts SQL (carpeta sql/). Solo activar en desarrollo.
      synchronize: this.configService.get<string>('DB_SYNCHRONIZE') === 'true',
      // Las fechas se guardan como timestamptz (instante real). La zona de sesión
      // se fija igual para que now() y los reportes en SQL salgan en hora chilena.
      extra: { options: '-c timezone=America/Santiago' },
      ssl:
        this.configService.get<string>('DB_SSL') === 'false'
          ? false
          : {
              // En RDS, poner DB_SSL_CA=/ruta/global-bundle.pem para validar el certificado.
              rejectUnauthorized: !!caPath,
              ...(caPath ? { ca: readFileSync(caPath, 'utf8') } : {}),
            },
    };
  }
}
