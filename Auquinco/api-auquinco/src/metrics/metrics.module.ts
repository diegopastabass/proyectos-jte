// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrAuquincoService } from './metrics.service';
import { SsrAuquincoController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrAuquincoService],
  controllers: [SsrAuquincoController],
  exports: [SsrAuquincoService],
})
export class SsrAuquincoModule {}
