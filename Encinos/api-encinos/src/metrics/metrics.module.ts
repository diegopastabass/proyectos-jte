// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncinosService } from './metrics.service';
import { EncinosController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [EncinosService],
  controllers: [EncinosController],
  exports: [EncinosService],
})
export class EncinosModule {}
