import { MeasurementsService } from './measurements.service';
import { CreateMeasurementDto } from './create-measurement.dto';
export declare class MeasurementsController {
    private readonly measurementsService;
    constructor(measurementsService: MeasurementsService);
    create(createMeasurementDto: CreateMeasurementDto): Promise<number>;
    findByMaintenance(id: number): Promise<import("./measurements.entity").Measurement[]>;
    findByDevice(id: number): Promise<import("./measurements.entity").Measurement[]>;
}
