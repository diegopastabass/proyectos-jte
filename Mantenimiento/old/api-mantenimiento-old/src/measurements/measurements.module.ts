// measurement.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeasurementsController } from './measurements.controller';
import { MeasurementsService } from './measurements.service';
import { Measurement } from './measurements.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Measurement])],
  controllers: [MeasurementsController],
  providers: [MeasurementsService],
})
export class MeasurementsModule {}
