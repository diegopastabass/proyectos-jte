// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrQuillayService } from './metrics.service';
import { SsrQuillayController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrQuillayService],
  controllers: [SsrQuillayController],
  exports: [SsrQuillayService],
})
export class SsrQuillayModule {}
