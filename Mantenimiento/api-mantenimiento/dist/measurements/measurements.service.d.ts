import { Repository } from 'typeorm';
import { Measurement } from './measurements.entity';
import { CreateMeasurementDto } from './create-measurement.dto';
export declare class MeasurementsService {
    private measurementsRepository;
    constructor(measurementsRepository: Repository<Measurement>);
    create(dto: CreateMeasurementDto): Promise<number>;
    findByMaintenance(maintenanceId: number): Promise<Measurement[]>;
    findByDevice(deviceId: number): Promise<Measurement[]>;
}
