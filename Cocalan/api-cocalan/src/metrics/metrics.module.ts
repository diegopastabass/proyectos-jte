// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrCocalanService } from './metrics.service';
import { SsrCocalanController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrCocalanService],
  controllers: [SsrCocalanController],
  exports: [SsrCocalanService],
})
export class SsrCocalanModule {}
