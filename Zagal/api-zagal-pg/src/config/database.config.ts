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
      // Deja en el log (warn) toda consulta que tarde más de 10 s
      maxQueryExecutionTime: 10_000,
      extra: {
        max: 10,
        // Postgres cancela la consulta en el servidor a los 5 min (libera CPU y locks)
        statement_timeout: 300_000,
        // Red de seguridad del cliente por si la conexión queda colgada
        query_timeout: 305_000,
        // Cierra sesiones que quedan con una transacción abierta sin actividad
        idle_in_transaction_session_timeout: 60_000,
        // No esperar indefinidamente por una conexión del pool
        connectionTimeoutMillis: 10_000,
      },
    };
  }
}