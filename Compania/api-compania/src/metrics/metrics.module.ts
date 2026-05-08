// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrCompaniaService } from './metrics.service';
import { SsrCompaniaController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrCompaniaService],
  controllers: [SsrCompaniaController],
  exports: [SsrCompaniaService],
})
export class SsrCompaniaModule {}
