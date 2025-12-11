// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrRanguilService } from './metrics.service';
import { SsrRanguilController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrRanguilService],
  controllers: [SsrRanguilController],
  exports: [SsrRanguilService],
})
export class SsrRanguilModule {}
