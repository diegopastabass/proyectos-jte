// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrCumpeoService } from './metrics.service';
import { SsrCumpeoController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrCumpeoService],
  controllers: [SsrCumpeoController],
  exports: [SsrCumpeoService],
})
export class SsrCumpeoModule {}
