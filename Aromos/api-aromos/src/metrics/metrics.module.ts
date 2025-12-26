// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrAromosService } from './metrics.service';
import { SsrAromosController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrAromosService],
  controllers: [SsrAromosController],
  exports: [SsrAromosService],
})
export class SsrAromosModule {}
