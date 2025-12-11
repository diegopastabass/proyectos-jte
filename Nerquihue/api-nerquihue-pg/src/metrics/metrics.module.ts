// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrNerquihueService } from './metrics.service';
import { SsrNerquihueController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrNerquihueService],
  controllers: [SsrNerquihueController],
  exports: [SsrNerquihueService],
})
export class SsrNerquihueModule {}
