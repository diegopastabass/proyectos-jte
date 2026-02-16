// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AraucariasService } from './metrics.service';
import { AraucariasController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [AraucariasService],
  controllers: [AraucariasController],
  exports: [AraucariasService],
})
export class AraucariasModule {}
