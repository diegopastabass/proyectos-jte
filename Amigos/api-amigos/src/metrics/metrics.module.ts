// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SSRAmigosService } from './metrics.service';
import { SSRAmigosController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SSRAmigosService],
  controllers: [SSRAmigosController],
  exports: [SSRAmigosService],
})
export class SSRAmigosModule {}
