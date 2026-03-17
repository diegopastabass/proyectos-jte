// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrIdahueService } from './metrics.service';
import { SsrIdahueController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrIdahueService],
  controllers: [SsrIdahueController],
  exports: [SsrIdahueService],
})
export class SsrIdahueModule {}
