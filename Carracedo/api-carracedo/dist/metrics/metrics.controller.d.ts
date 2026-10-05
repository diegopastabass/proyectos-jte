import { CarracedoService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class CarracedoController {
    private readonly service;
    constructor(service: CarracedoService);
    getSnapshot(): Promise<import("./models/types").MetricSnapshot>;
    getTotalizador(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
