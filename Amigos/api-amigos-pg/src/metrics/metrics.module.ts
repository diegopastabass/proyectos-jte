// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AmigosService } from './metrics.service';
import { AmigosController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [AmigosService],
  controllers: [AmigosController],
  exports: [AmigosService],
})
export class AmigosModule {}
