// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrCaliforniaService } from './metrics.service';
import { SsrCaliforniaController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrCaliforniaService],
  controllers: [SsrCaliforniaController],
  exports: [SsrCaliforniaService],
})
export class SsrCaliforniaModule {}
