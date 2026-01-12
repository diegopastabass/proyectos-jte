// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrPuQuillayService } from './metrics.service';
import { SsrPuQuillayController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrPuQuillayService],
  controllers: [SsrPuQuillayController],
  exports: [SsrPuQuillayService],
})
export class SsrPuQuillayModule {}
