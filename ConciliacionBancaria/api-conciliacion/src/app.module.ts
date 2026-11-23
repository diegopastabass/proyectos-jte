import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ComprobantesModule } from './comprobantes/comprobantes.module';
import { ConciliacionModule } from './conciliacion/conciliacion.module';
import { DatabaseConfig } from './config/database.config';
import { DatabaseModule } from './config/database.module';
import { DocumentosModule } from './documentos/documentos.module';
import { EmpresasModule } from './empresas/empresas.module';
import { ENTIDADES } from './entities';
import { ImportacionModule } from './importacion/importacion.module';
import { IngestaModule } from './ingesta/ingesta.module';
import { MotorModule } from './motor/motor.module';
import { MovimientosModule } from './movimientos/movimientos.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { ReportesModule } from './reportes/reportes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [DatabaseModule],
      useExisting: DatabaseConfig,
    }),
    TypeOrmModule.forFeature(ENTIDADES),
    DatabaseModule,
    AuthModule,
    EmpresasModule,
    ImportacionModule,
    MovimientosModule,
    DocumentosModule,
    ConciliacionModule,
    MotorModule,
    ComprobantesModule,
    ProyectosModule,
    ReportesModule,
    IngestaModule,
  ],
})
export class AppModule {}
