// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrCuevasService } from './metrics.service';
import { SsrCuevasController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrCuevasService],
  controllers: [SsrCuevasController],
  exports: [SsrCuevasService],
})
export class SsrCuevasModule {}
