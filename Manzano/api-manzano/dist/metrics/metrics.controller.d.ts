import { SsrManzanoService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SsrManzanoController {
    private readonly service;
    constructor(service: SsrManzanoService);
    getSnapshot(): Promise<{
        snapshot: import("./models/types").MetricSnapshot;
        tiempo_vaciado: number;
        tiempo_vaciado_formatted: string;
    }>;
    getHorometro(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
