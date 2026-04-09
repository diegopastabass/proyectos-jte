// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrZunigaService } from './metrics.service';
import { SsrZunigaController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrZunigaService],
  controllers: [SsrZunigaController],
  exports: [SsrZunigaService],
})
export class SsrZunigaModule {}
