// metrics.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsrManzanoService } from './metrics.service';
import { SsrManzanoController } from './metrics.controller';
import { Telemetria } from './models/metrics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetria])],
  providers: [SsrManzanoService],
  controllers: [SsrManzanoController],
  exports: [SsrManzanoService],
})
export class SsrManzanoModule {}
