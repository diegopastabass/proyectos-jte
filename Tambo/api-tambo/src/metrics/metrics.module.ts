// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrTamboService } from './metrics.service';
import { SsrTamboController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrTamboService],
  controllers: [SsrTamboController],
  exports: [SsrTamboService],
})
export class SsrTamboModule {}
