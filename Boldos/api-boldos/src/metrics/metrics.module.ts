// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrBoldosService } from './metrics.service';
import { SsrBoldosController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrBoldosService],
  controllers: [SsrBoldosController],
  exports: [SsrBoldosService],
})
export class SsrBoldosModule {}
