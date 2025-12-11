// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrGonzalezService } from './metrics.service';
import { SsrGonzalezController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrGonzalezService],
  controllers: [SsrGonzalezController],
  exports: [SsrGonzalezService],
})
export class SsrGonzalezModule {}
