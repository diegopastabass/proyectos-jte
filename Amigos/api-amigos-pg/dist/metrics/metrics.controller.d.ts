import { SSRAmigosService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SSRAmigosController {
    private readonly service;
    constructor(service: SSRAmigosService);
    getSnapshot(): Promise<import("./models/types").MetricSnapshot>;
    getTotalizador(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
