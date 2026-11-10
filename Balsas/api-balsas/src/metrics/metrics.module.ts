import { Module } from '@nestjs/common';
import { SsrBalsasService } from './metrics.service';
import { SsrBalsasController } from './metrics.controller';

@Module({
  providers: [SsrBalsasService],
  controllers: [SsrBalsasController],
  exports: [SsrBalsasService],
})
export class SsrBalsasModule {}
