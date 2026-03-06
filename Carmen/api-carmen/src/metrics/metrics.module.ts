// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrCarmenService } from './metrics.service';
import { SsrCarmenController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrCarmenService],
  controllers: [SsrCarmenController],
  exports: [SsrCarmenService],
})
export class SsrCarmenModule {}
