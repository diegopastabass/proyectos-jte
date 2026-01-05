// measurement.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Measurement } from './measurements.entity';
import { CreateMeasurementDto } from './create-measurement.dto';

@Injectable()
export class MeasurementsService {
  constructor(
    @InjectRepository(Measurement)
    private measurementsRepository: Repository<Measurement>,
  ) {}

  async create(dto: CreateMeasurementDto): Promise<number> {
    const measurement = this.measurementsRepository.create(dto);
    await this.measurementsRepository.save(measurement);
    return measurement.id;
  }

  async findByMaintenance(maintenanceId: number): Promise<Measurement[]> {
    return this.measurementsRepository.find({
      where: { maintenance_id: maintenanceId },
    });
  }

  async findByDevice(deviceId: number): Promise<Measurement[]> {
    return this.measurementsRepository.find({
      where: { device_id: deviceId },
    });
  }
}
