// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarracedoService } from './metrics.service';
import { CarracedoController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [CarracedoService],
  controllers: [CarracedoController],
  exports: [CarracedoService],
})
export class CarracedoModule {}
