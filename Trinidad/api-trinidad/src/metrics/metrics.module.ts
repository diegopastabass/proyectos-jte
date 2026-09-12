// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrTrinidadService } from './metrics.service';
import { SsrTrinidadController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrTrinidadService],
  controllers: [SsrTrinidadController],
  exports: [SsrTrinidadService],
})
export class SsrTrinidadModule {}
