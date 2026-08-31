import { SsrCumpeoService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';
export declare class SsrCumpeoController {
    private readonly service;
    constructor(service: SsrCumpeoService);
    getSnapshot(): Promise<{
        snapshot: import("./models/types").MetricSnapshot;
        tiempo_vaciado: number;
        tiempo_vaciado_formatted: string;
    }>;
    getTotalizador(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getHorometro(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getNivel2(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
    getCaudal(dto: DateRangeDto): Promise<import("./models/types").Metric[]>;
}
