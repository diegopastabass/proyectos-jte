// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MirafloresService } from './metrics.service';
import { MirafloresController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [MirafloresService],
  controllers: [MirafloresController],
  exports: [MirafloresService],
})
export class MirafloresModule {}
